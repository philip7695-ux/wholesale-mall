import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiRoute } from "@/lib/api-route"
import { applyVat } from "@/lib/trade"
import {
  isEditable,
  adjustReservation,
  refreshProductStock,
} from "@/lib/order-revision"

/**
 * 확정 전 주문의 수량을 고친다.
 *
 * 창고에서 물건을 확인한 뒤 관리자가 줄이고, 바이어가 보고 다시 고치는
 * 과정이 오간다. 수량이 바뀌면 예약도 같은 폭으로 움직이고 금액을 다시 센다.
 *
 * body: { items: [{ id, quantity }], next?: "STOCK_CHECKING" | "BUYER_REVIEW" }
 *   next 를 주면 수량을 고치면서 상대에게 넘긴다.
 */

async function PUT_impl(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { items, next } = await request.json()

  if (!Array.isArray(items)) {
    return NextResponse.json({ error: "수량 정보가 올바르지 않습니다." }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
  }

  const isAdmin = session.user.role === "ADMIN"
  if (!isAdmin && order.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }
  if (!isEditable(order.status)) {
    return NextResponse.json(
      { error: "확정된 주문은 수량을 바꿀 수 없습니다." },
      { status: 400 },
    )
  }
  // 바이어는 자기 차례에만 고칠 수 있다. 관리자가 확인하는 동안 값이
  // 바뀌면 어느 쪽 수량이 맞는지 알 수 없게 된다.
  if (!isAdmin && order.status !== "BUYER_REVIEW") {
    return NextResponse.json(
      { error: "지금은 수량을 바꿀 수 없습니다. 확인 요청을 기다려주세요." },
      { status: 400 },
    )
  }
  if (next && !["STOCK_CHECKING", "BUYER_REVIEW"].includes(next)) {
    return NextResponse.json({ error: "알 수 없는 단계입니다." }, { status: 400 })
  }
  if (next === "STOCK_CHECKING" && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const byId = new Map(order.items.map((i) => [i.id, i]))
  const changes: { item: (typeof order.items)[number]; quantity: number }[] = []

  for (const raw of items) {
    const item = byId.get(raw?.id)
    if (!item) {
      return NextResponse.json({ error: "주문에 없는 항목입니다." }, { status: 400 })
    }
    const q = Number(raw?.quantity)
    if (!Number.isInteger(q) || q < 0) {
      return NextResponse.json({ error: "수량은 0 이상의 정수여야 합니다." }, { status: 400 })
    }
    // 바이어는 처음 주문한 수량을 넘겨 늘릴 수 없다. 늘리려면 새로 주문해야
    // 재고와 MOQ 를 다시 확인할 수 있다.
    if (!isAdmin && q > item.orderedQuantity) {
      return NextResponse.json(
        { error: "처음 주문한 수량보다 늘릴 수 없습니다. 추가 주문을 이용해주세요." },
        { status: 400 },
      )
    }
    if (q !== item.quantity) changes.push({ item, quantity: q })
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const { item, quantity } of changes) {
      await adjustReservation(tx, item.variantId, quantity - item.quantity)
      if (quantity === 0) {
        await tx.orderItem.delete({ where: { id: item.id } })
      } else {
        await tx.orderItem.update({ where: { id: item.id }, data: { quantity } })
      }
    }

    // 금액을 다시 센다. 단가는 주문 시점 값을 그대로 쓴다.
    const rest = await tx.orderItem.findMany({ where: { orderId: id } })
    const itemsTotal = rest.reduce((s, i) => s + i.price * i.quantity, 0)
    const { supplyAmount, vatAmount, totalAmount } = applyVat(itemsTotal, order.vatRate)

    const result = await tx.order.update({
      where: { id },
      data: {
        supplyAmount,
        vatAmount,
        totalAmount,
        ...(next ? { status: next } : {}),
      },
      include: { items: true },
    })

    // 예약이 바뀌었으므로 판매 가능 수량도 다시 계산한다
    const variantIds = changes.map((c) => c.item.variantId).filter(Boolean) as string[]
    if (variantIds.length) {
      const vs = await tx.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { productId: true },
      })
      await refreshProductStock(tx, [...new Set(vs.map((v) => v.productId))])
    }
    return result
  })

  return NextResponse.json(updated)
}

export const PUT = apiRoute(PUT_impl, { retry: false })
