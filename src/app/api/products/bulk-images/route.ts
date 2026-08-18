import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// Vercel 요청 본문 한도(4.5MB) 때문에 클라이언트가 파일을 나눠 보낸다.
export const maxDuration = 60

interface ParsedFile {
  code: string
  order: number
  file: File
}

function parseFileName(fileName: string): { code: string; order: number } | null {
  // Remove extension
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, "")
  if (!nameWithoutExt) return null

  // Split by _ and check if last part is a number
  const parts = nameWithoutExt.split("_")

  if (parts.length >= 2) {
    const orderStr = parts[parts.length - 1]
    const order = parseInt(orderStr, 10)
    if (!isNaN(order)) {
      const code = parts.slice(0, -1).join("_")
      if (code) return { code, order }
    }
  }

  // No _order suffix — treat entire name as product code, order = 1
  return { code: nameWithoutExt, order: 1 }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const files = formData.getAll("files") as File[]
    // 재업로드 시 이미지가 계속 누적되는 것을 막는다.
    // 한 상품의 이미지는 항상 같은 요청에 담기므로 상품 단위로 안전하게 교체된다.
    const replace = String(formData.get("mode") ?? "") === "replace"

    if (files.length === 0) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 })
    }

    const failed: { file: string; error: string }[] = []
    const parsed: ParsedFile[] = []

    // 1. Parse file names
    for (const file of files) {
      const result = parseFileName(file.name)
      if (!result) {
        failed.push({ file: file.name, error: "파일명 형식이 올바르지 않습니다. (예: ST001_1.jpg)" })
        continue
      }
      parsed.push({ code: result.code, order: result.order, file })
    }

    // 2. Group by product code
    const codeGroups = new Map<string, ParsedFile[]>()
    for (const p of parsed) {
      const group = codeGroups.get(p.code) || []
      group.push(p)
      codeGroups.set(p.code, group)
    }

    // 3. Resolve product codes to products (case-insensitive)
    //
    // Prisma 의 `mode: "insensitive"` 는 `in` 과 함께 쓰면 조용히 0건을 반환한다
    // (에러가 아니라 빈 결과라서 "상품이 없습니다" 로만 보인다).
    // 대소문자 무시는 OR + equals 로 처리한다.
    const codes = [...codeGroups.keys()]
    const products = await prisma.product.findMany({
      where: {
        OR: codes.map((code) => ({
          code: { equals: code, mode: "insensitive" as const },
        })),
      },
      select: { id: true, code: true, images: true, thumbnail: true },
    })
    // Map by lowercase code for case-insensitive lookup
    const productMap = new Map(products.map((p) => [p.code!.toLowerCase(), p]))

    // Mark files with unknown codes as failed
    for (const code of codes) {
      if (!productMap.has(code.toLowerCase())) {
        const group = codeGroups.get(code)!
        for (const p of group) {
          failed.push({ file: p.file.name, error: `상품코드 "${code}"에 해당하는 상품이 없습니다.` })
        }
        codeGroups.delete(code)
      }
    }

    // 4. Upload images and update products
    const supabase = getSupabase()
    let success = 0

    for (const [code, group] of codeGroups) {
      const product = productMap.get(code.toLowerCase())!
      // Sort by order number
      group.sort((a, b) => a.order - b.order)

      const uploadedUrls: string[] = []

      for (const item of group) {
        try {
          const bytes = await item.file.arrayBuffer()
          const buffer = Buffer.from(bytes)

          const ext = item.file.name.split(".").pop() || "jpg"
          const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
          const filePath = `products/${fileName}`

          const { error } = await supabase.storage
            .from("images")
            .upload(filePath, buffer, {
              contentType: item.file.type,
              upsert: false,
            })

          if (error) {
            failed.push({ file: item.file.name, error: `업로드 실패: ${error.message}` })
            continue
          }

          const { data: urlData } = supabase.storage
            .from("images")
            .getPublicUrl(filePath)

          uploadedUrls.push(urlData.publicUrl)
          success++
        } catch (err: any) {
          failed.push({ file: item.file.name, error: `업로드 오류: ${err.message}` })
        }
      }

      if (uploadedUrls.length > 0) {
        const newImages = replace ? uploadedUrls : [...product.images, ...uploadedUrls]
        const thumbnail = replace ? uploadedUrls[0] : (product.thumbnail || uploadedUrls[0])

        await prisma.product.update({
          where: { id: product.id },
          data: { images: newImages, thumbnail },
        })
      }
    }

    return NextResponse.json({ success, failed })
  } catch (error: any) {
    console.error("Bulk image upload error:", error)
    const detail = [error?.code, error?.message].filter(Boolean).join(" ")
    return NextResponse.json(
      { error: `이미지 업로드 처리 중 오류가 발생했습니다. ${detail}`.trim() },
      { status: 500 },
    )
  }
}
