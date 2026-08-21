import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { lookbookDownloadUrl } from "@/lib/storage"
import { apiRoute } from "@/lib/api-route"

// 로그인한 회원만. Cloudinary 서명 다운로드 URL 로 리다이렉트한다.
// (PDF 공개 전송이 계정에서 막혀 있어 직접 링크는 401 이 난다.)
async function GET_impl(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const lb = await prisma.lookbook.findUnique({ where: { id } })
  if (!lb || !lb.isActive) {
    return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 })
  }
  const url = lookbookDownloadUrl(lb.publicId, `${lb.title}.${lb.format || "pdf"}`)
  return NextResponse.redirect(url)
}

export const GET = apiRoute(GET_impl, { retry: false })
