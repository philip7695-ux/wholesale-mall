import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiRoute } from "@/lib/api-route"

// 바이어 사이드바 배지용. 바이어가 손댈 차례인 주문 수.
// 흐름에서 공이 바이어 쪽에 있는 모든 단계를 센다:
//  - BUYER_REVIEW: 판매자가 조정안을 보내 확인을 요청함
//  - INVOICE_SENT: 인보이스가 나가 결제를 기다림
//    (단, 이미 입금증빙을 올려 확인 대기 중이면 관리자 차례이므로 뺀다)
async function GET_impl() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const userId = session.user.id
  const [needsReview, needsPayment] = await Promise.all([
    prisma.order.count({ where: { userId, status: "BUYER_REVIEW" } }),
    prisma.order.count({
      where: {
        userId,
        status: "INVOICE_SENT",
        paymentConfirmations: { none: { status: "PENDING" } },
      },
    }),
  ])
  const actionRequired = needsReview + needsPayment
  return NextResponse.json({ needsReview, needsPayment, actionRequired })
}

export const GET = apiRoute(GET_impl, { retry: true })
