import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { lookbookDownloadUrl } from "@/lib/storage"

export const dynamic = "force-dynamic"

// 로그인한 회원만. 서명된 Cloudinary 다운로드 URL 을 돌려준다.
// (PDF 공개 전송이 계정에서 막혀 있어 직접 링크는 401 이 난다. 서명
//  download 엔드포인트는 그 제한을 우회한다.)
// 리다이렉트 대신 URL 을 넘겨 클라이언트가 이동하게 한다 — 브라우저마다
// 크로스도메인 리다이렉트 처리가 달라 이쪽이 확실하다.
// apiRoute 래퍼는 쓰지 않는다.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
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
    return NextResponse.json({ url })
  } catch (e) {
    console.error("[lookbook download] error:", e)
    return NextResponse.json({ error: "다운로드에 실패했습니다." }, { status: 500 })
  }
}
