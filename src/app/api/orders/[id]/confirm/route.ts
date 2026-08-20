import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiRoute } from "@/lib/api-route"
import { isEditable, commitReservation, refreshProductStock } from "@/lib/order-revision"

/**
 * 주문 확정. 관리자만 한다.
 *
 * 이 시점에 예약이 실재고 차감으로 바뀐다. 여기까지 오면 창고 확인과
 * 바이어 확인이 끝난 것이므로, 이후에는 수량을 고칠 수 없다.
 */
async function POST_impl(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
  }
  if (!isEditable(order.status)) {
    return NextResponse.json({ error: "이미 확정된 주문입니다." }, { status: 400 })
  }
  if (order.items.length === 0) {
    return NextResponse.json(
      { error: "수량이 모두 0 입니다. 확정할 항목이 없습니다." },
      { status: 400 },
    )
  }

  const updated = await prisma.$transaction(async (tx) => {
    await commitReservation(tx, id)

    const variantIds = order.items.map((i) => i.variantId).filter(Boolean) as string[]
    if (variantIds.length) {
      const vs = await tx.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { productId: true },
      })
      await refreshProductStock(tx, [...new Set(vs.map((v) => v.productId))])
    }

    return tx.order.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedAt: new Date() },
      include: { items: true },
    })
  })

  return NextResponse.json(updated)
}

export const POST = apiRoute(POST_impl, { retry: false })
