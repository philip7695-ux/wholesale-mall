import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiRoute } from "@/lib/api-route"

async function GET_impl() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const items = await prisma.lookbook.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  })
  return NextResponse.json(items)
}

// 브라우저가 Cloudinary 업로드를 끝낸 뒤, 그 주소로 레코드를 만든다.
async function POST_impl(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { title, publicId, url, format, bytes } = await request.json()
  if (!title?.trim() || !publicId || !url) {
    return NextResponse.json({ error: "제목과 파일이 필요합니다." }, { status: 400 })
  }
  const created = await prisma.lookbook.create({
    data: {
      title: String(title).trim(),
      publicId: String(publicId),
      url: String(url),
      format: format ? String(format) : null,
      bytes: Number(bytes) || 0,
    },
  })
  return NextResponse.json(created, { status: 201 })
}

export const GET = apiRoute(GET_impl, { retry: true })
export const POST = apiRoute(POST_impl, { retry: false })
