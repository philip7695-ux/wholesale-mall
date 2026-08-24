import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiRoute } from "@/lib/api-route"
import { resolveOrderPaymentInfo } from "@/lib/payment-setting.server"

/**
 * 이 주문의 결제 정보(계좌/QR). 인보이스에 실린 것과 같은 값을 준다.
 * 바이어 결제 화면이 인보이스와 어긋나지 않게 한곳(resolveOrderPaymentInfo)을 본다.
 */
async function GET_impl(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      userId: true,
      invoicePaymentMethod: true,
      paymentMethod: true,
      user: { select: { tradeType: true } },
    },
  })
  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
  }
  if (session.user.role !== "ADMIN" && order.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }
  const info = await resolveOrderPaymentInfo(order)
  return NextResponse.json(info)
}

export const GET = apiRoute(GET_impl, { retry: true })
