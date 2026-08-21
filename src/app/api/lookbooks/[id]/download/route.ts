import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { lookbookDownloadUrl } from "@/lib/storage"

export const dynamic = "force-dynamic"

// 로그인한 회원만. 파일을 우리 서버가 받아 "다운로드"로 흘려준다.
//
// Cloudinary 서명 URL 로 리다이렉트만 하면 브라우저가 PDF 를 같은 창에서
// 열어버린다. 여기서 Content-Disposition: attachment 를 우리 도메인 응답에
// 실어 주면, 창을 떠나지 않고 바로 내려받는다. 6MB 안팎이라 버퍼링하지 않고
// 그대로 흘려보낸다(Vercel 응답 크기 제한 회피).
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

    const signed = lookbookDownloadUrl(lb.publicId)
    const upstream = await fetch(signed)
    if (!upstream.ok || !upstream.body) {
      console.error("[lookbook download] upstream:", upstream.status)
      return NextResponse.json({ error: "파일을 가져오지 못했습니다." }, { status: 502 })
    }

    const filename = `${lb.title}.${lb.format || "pdf"}`.replace(/[\r\n"]/g, "")
    const headers = new Headers()
    headers.set("Content-Type", upstream.headers.get("content-type") || "application/pdf")
    headers.set(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    )
    const len = upstream.headers.get("content-length")
    if (len) headers.set("Content-Length", len)
    headers.set("Cache-Control", "private, no-store")

    return new NextResponse(upstream.body, { headers })
  } catch (e) {
    console.error("[lookbook download] error:", e)
    return NextResponse.json({ error: "다운로드에 실패했습니다." }, { status: 500 })
  }
}
