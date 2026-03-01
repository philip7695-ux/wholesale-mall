import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const items = await prisma.cartItem.findMany({
    where: { userId: session.user.id },
    include: {
      variant: {
        include: {
          product: { include: { colors: true } },
          color: true,
          size: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(items)
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { items } = await request.json()

  for (const item of items as { variantId: string; quantity: number }[]) {
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

  return NextResponse.json({ message: "장바구니에 추가되었습니다." })
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { cartItemId, quantity } = await request.json()

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: cartItemId } })
  } else {
    await prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
    })
  }

  return NextResponse.json({ message: "수량이 변경되었습니다." })
}

export async function DELETE(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { cartItemId } = await request.json()
  await prisma.cartItem.delete({ where: { id: cartItemId } })

  return NextResponse.json({ message: "삭제되었습니다." })
}
