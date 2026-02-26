import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateOrderNumber } from "@/lib/utils"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const where = session.user.role === "ADMIN" ? {} : { userId: session.user.id }

  const orders = await prisma.order.findMany({
    where,
    include: {
      user: { select: { name: true, email: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(orders)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { recipientName, recipientPhone, shippingAddress, shippingMemo, paymentMethod } =
      await request.json()

    // Get cart items
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: session.user.id },
      include: {
        variant: {
          include: {
            product: true,
            color: true,
            size: true,
          },
        },
      },
    })

    if (cartItems.length === 0) {
      return NextResponse.json({ error: "장바구니가 비어있습니다." }, { status: 400 })
    }

    const totalAmount = cartItems.reduce(
      (sum: any, item: any) => sum + item.variant.price * item.quantity,
      0,
    )

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: session.user.id,
        totalAmount,
        paymentMethod: paymentMethod || "BANK_TRANSFER",
        recipientName,
        recipientPhone,
        shippingAddress,
        shippingMemo,
        items: {
          create: cartItems.map((item: any) => ({
            variantId: item.variant.id,
            quantity: item.quantity,
            price: item.variant.price,
            productName: item.variant.product.name,
            colorName: item.variant.color.name,
            sizeName: item.variant.size.name,
          })),
        },
      },
      include: { items: true },
    })

    // Clear cart
    await prisma.cartItem.deleteMany({
      where: { userId: session.user.id },
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error("Order creation error:", error)
    return NextResponse.json(
      { error: "주문 처리 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
