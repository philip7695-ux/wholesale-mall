import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { uploadImage } from "@/lib/storage"

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const uploadType = formData.get("type") as string | null

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 })
    }

    // 권한: receipt(입금증)는 승인된 회원, 그 외(상품/QR 등)는 ADMIN만
    if (uploadType === "receipt") {
      if (session.user.approvalStatus !== "APPROVED") {
        return NextResponse.json({ error: "회원 승인 후 이용 가능합니다." }, { status: 403 })
      }
    } else if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 파일 검증: 이미지 MIME 화이트리스트 + 용량 상한(10MB)
    const ALLOWED = new Map<string, string>([
      ["image/jpeg", "jpg"],
      ["image/png", "png"],
      ["image/webp", "webp"],
      ["image/gif", "gif"],
    ])
    const MAX_BYTES = 10 * 1024 * 1024
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: "이미지 파일(JPG/PNG/WEBP/GIF)만 업로드할 수 있습니다." }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "파일 용량은 10MB 이하여야 합니다." }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const folderMap: Record<string, string> = { receipt: "receipts", payment: "payment", qrcode: "qrcode" }
    const folder = folderMap[uploadType || ""] || "products"

    try {
      const url = await uploadImage(buffer, { folder })
      return NextResponse.json({ url })
    } catch (err: any) {
      console.error("Cloudinary upload error:", err)
      return NextResponse.json(
        { error: `업로드에 실패했습니다. ${err?.message ?? ""}`.trim() },
        { status: 500 },
      )
    }
  } catch (e: any) {
    console.error("Upload error:", e)
    return NextResponse.json(
      { error: "업로드 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
