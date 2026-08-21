import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiRoute } from "@/lib/api-route"

// 바이어 사이드바 배지용. 바이어가 손댈 차례인 주문 수.
// 판매자가 조정안을 보내 확인을 요청한 상태(BUYER_REVIEW)를 센다.
async function GET_impl() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const needsReview = await prisma.order.count({
    where: { userId: session.user.id, status: "BUYER_REVIEW" },
  })
  return NextResponse.json({ needsReview, actionRequired: needsReview })
}

export const GET = apiRoute(GET_impl, { retry: true })
