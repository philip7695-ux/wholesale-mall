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
  // 관리자가 손댈 차례인 주문:
  //  - 조정 흐름에서 공이 관리자 쪽에 있는 상태(접수/조정중/확정대기)
  //  - 바이어가 입금증빙을 올려 확인을 기다리는 주문(상태 무관)
  // 조정 왕복 중 바이어가 STOCK_CHECKING 으로 되돌리는 것이 "확인요청"이라
  // STOCK_CHECKING 도 관리자 차례로 본다.
  const [actionOrders, pendingMembers] = await Promise.all([
    prisma.order.count({
      where: {
        OR: [
          { status: { in: ["ORDER_PLACED", "STOCK_CHECKING", "CONFIRMED"] } },
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
