import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { sendTestEmail } from "@/lib/email"
import { apiRoute } from "@/lib/api-route"

// 메일 설정이 실제로 동작하는지 확인하는 테스트 발송(관리자 전용).
async function POST_impl(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { to } = await request.json().catch(() => ({}))
  const target = typeof to === "string" && to.trim() ? to.trim() : session.user.email
  if (!target) {
    return NextResponse.json({ error: "받는 주소가 없습니다." }, { status: 400 })
  }
  const result = await sendTestEmail(target)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true, to: target })
}

export const POST = apiRoute(POST_impl, { retry: false })
