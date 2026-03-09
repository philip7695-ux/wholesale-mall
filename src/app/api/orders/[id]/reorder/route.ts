import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getApiTranslations } from "@/lib/api-i18n"

// 주문 상품을 장바구니로 복원하고, 주문을 취소
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const t = await getApiTranslations(request, "api")
  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  })

  if (!order) {
    return NextResponse.json({ error: t("orderNotFound") }, { status: 404 })
  }

  if (order.userId !== session.user.id && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  if (order.status !== "ORDER_PLACED") {
    return NextResponse.json(
      { error: t("onlyPlacedEdit") },
      { status: 400 },
    )
  }

  // 주문 상품을 장바구니로 복원
  for (const item of order.items) {
    if (!item.variantId) continue

    const existing = await prisma.cartItem.findUnique({
      where: {
        userId_variantId: {
          userId: session.user.id,
          variantId: item.variantId,
        },
      },
    })

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + item.quantity },
      })
    } else {
      await prisma.cartItem.create({
        data: {
          userId: session.user.id,
          variantId: item.variantId,
          quantity: item.quantity,
        },
      })
    }
  }

  // 주문 취소
  await prisma.order.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  })

  return NextResponse.json({ message: t("orderRestoredToCart") })
}
