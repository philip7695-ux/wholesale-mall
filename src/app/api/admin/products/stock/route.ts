import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"
import { ALL_SIZES } from "@/lib/product-sizes"

// GET: 재고 현황 엑셀 다운로드
export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      colors: { orderBy: { sortOrder: "asc" } },
      sizes: { orderBy: { sortOrder: "asc" } },
      variants: {
        include: { color: true, size: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // 전체에서 사용되는 사이즈 수집 (정렬)
  const allUsedSizes = new Set<string>()
  for (const p of products) {
    for (const s of p.sizes) {
      allUsedSizes.add(s.name)
    }
  }
  const sizeColumns = [...allUsedSizes].sort((a, b) => {
    const ai = ALL_SIZES.indexOf(a)
    const bi = ALL_SIZES.indexOf(b)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  const baseHeaders = ["상품코드", "상품명", "컬러명", "가격"]
  const headers = [...baseHeaders, ...sizeColumns]

  const rows: any[][] = []
  for (const product of products) {
    for (const color of product.colors) {
      const row: any[] = [
        product.code || "",
        product.name,
        color.name,
        // 해당 컬러의 첫 번째 variant 가격
        product.variants.find((v: any) => v.colorId === color.id)?.price ?? 0,
      ]
      // 사이즈별 재고
      for (const sizeName of sizeColumns) {
        const variant = product.variants.find(
          (v: any) => v.colorId === color.id && v.size.name === sizeName
        )
        row.push(variant ? variant.stock : "")
      }
      rows.push(row)
    }
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws["!cols"] = [
    { wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 10 },
    ...sizeColumns.map(() => ({ wch: 8 })),
  ]
  XLSX.utils.book_append_sheet(wb, ws, "재고현황")

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  const fileName = `재고현황_${new Date().toISOString().split("T")[0]}.xlsx`

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}

// POST: 재고 업데이트 엑셀 업로드
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: "buffer" })

    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) return NextResponse.json({ error: "시트가 없습니다." }, { status: 400 })

    const rows = XLSX.utils.sheet_to_json(ws) as Record<string, any>[]
    if (rows.length === 0) return NextResponse.json({ error: "데이터가 없습니다." }, { status: 400 })

    // 헤더에서 사이즈 컬럼 추출 (기본 컬럼 제외한 나머지가 사이즈)
    const baseKeys = new Set(["상품코드", "상품명", "컬러명", "가격"])
    const firstRow = rows[0]
    const sizeColumns = Object.keys(firstRow).filter((k) => !baseKeys.has(k))

    let updated = 0
    const failed: { row: number; error: string }[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2
      const code = String(row["상품코드"] ?? "").trim()
      const name = String(row["상품명"] ?? "").trim()
      const colorName = String(row["컬러명"] ?? "").trim()

      if (!name && !code) {
        failed.push({ row: rowNum, error: "상품코드 또는 상품명이 필요합니다." })
        continue
      }
      if (!colorName) {
        failed.push({ row: rowNum, error: "컬러명이 비어있습니다." })
        continue
      }

      // 상품 찾기: 상품코드 우선, 없으면 상품명
      const product = code
        ? await prisma.product.findFirst({
            where: { code },
            include: {
              colors: true,
              sizes: true,
              variants: { include: { color: true, size: true } },
            },
          })
        : await prisma.product.findFirst({
            where: { name },
            include: {
              colors: true,
              sizes: true,
              variants: { include: { color: true, size: true } },
            },
          })

      if (!product) {
        failed.push({ row: rowNum, error: `상품을 찾을 수 없습니다: ${code || name}` })
        continue
      }

      const color = product.colors.find((c: any) => c.name === colorName)
      if (!color) {
        failed.push({ row: rowNum, error: `컬러를 찾을 수 없습니다: ${colorName} (상품: ${product.name})` })
        continue
      }

      // 사이즈별 재고 업데이트
      // 빈 셀 = 변경 없음, 숫자 > 0 = 재고 설정 (없으면 생성), 0 = variant 삭제
      for (const sizeName of sizeColumns) {
        const val = row[sizeName]
        if (val === undefined || val === null || val === "") continue

        const stock = Number(val)
        if (isNaN(stock)) continue

        const variant = product.variants.find(
          (v: any) => v.colorId === color.id && v.size.name === sizeName
        )

        if (stock <= 0) {
          // 0 입력 → variant 삭제 (해당 사이즈 제거)
          if (variant) {
            await prisma.productVariant.delete({ where: { id: variant.id } })
            // 해당 사이즈에 다른 variant가 없으면 ProductSize도 삭제
            const remainingVariants = await prisma.productVariant.count({
              where: { productId: product.id, sizeId: variant.sizeId },
            })
            if (remainingVariants === 0) {
              await prisma.productSize.delete({ where: { id: variant.sizeId } })
            }
            updated++
          }
        } else if (variant) {
          // 기존 variant 재고 업데이트
          await prisma.productVariant.update({
            where: { id: variant.id },
            data: { stock },
          })
          updated++
        } else {
          // variant가 없으면 사이즈 확인/생성 후 variant 생성
          let size = product.sizes.find((s: any) => s.name === sizeName)
          if (!size) {
            size = await prisma.productSize.create({
              data: {
                productId: product.id,
                name: sizeName,
                sortOrder: ALL_SIZES.indexOf(sizeName) >= 0 ? ALL_SIZES.indexOf(sizeName) : 999,
              },
            })
          }
          const price = product.variants.find((v: any) => v.colorId === color.id)?.price ?? 0
          await prisma.productVariant.create({
            data: {
              productId: product.id,
              colorId: color.id,
              sizeId: size.id,
              price,
              stock,
            },
          })
          updated++
        }
      }
    }

    return NextResponse.json({ updated, failed })
  } catch (error: any) {
    console.error("Stock update error:", error)
    return NextResponse.json({ error: "재고 업데이트 처리 중 오류가 발생했습니다." }, { status: 500 })
  }
}
