import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiRoute } from "@/lib/api-route"

// 사이드바 알림 배지용 카운트. 관리자가 아직 손대지 않은 것들.
async function GET_impl() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  // 관리자가 손댈 차례인 주문 — 흐름에서 공이 관리자 쪽에 있는 모든 단계:
  //  - ORDER_PLACED: 새 주문, 재고 확인 시작
  //  - STOCK_CHECKING: 조정 중(바이어가 되돌린 확인요청 포함)
  //  - CONFIRMED: 인보이스 발행 대기
  //  - PAYMENT_CONFIRMED: 출고 대기
  //  - 바이어가 입금증빙을 올려 확인을 기다리는 주문(상태 무관)
  const [actionOrders, pendingMembers] = await Promise.all([
    prisma.order.count({
      where: {
        OR: [
          { status: { in: ["ORDER_PLACED", "STOCK_CHECKING", "CONFIRMED", "PAYMENT_CONFIRMED"] } },
          { paymentConfirmations: { some: { status: "PENDING" } } },
        ],
      },
    }),
    prisma.user.count({ where: { role: "BUYER", approvalStatus: "PENDING" } }),
  ])
  // newOrders 는 기존 이름 유지(접수만). 배지는 actionOrders 를 쓴다.
  return NextResponse.json({ newOrders: actionOrders, actionOrders, pendingMembers })
}

export const GET = apiRoute(GET_impl, { retry: true })
