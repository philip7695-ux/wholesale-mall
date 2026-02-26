import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      items: {
        include: {
          variant: {
            include: { product: { select: { thumbnail: true } } },
          },
        },
      },
    },
  })

  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
  }

  // Only allow owner or admin
  if (session.user.role !== "ADMIN" && order.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  return NextResponse.json(order)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const order = await prisma.order.findUnique({ where: { id } })

  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
  }

  // 본인 주문이거나 관리자만 삭제 가능
  if (session.user.role !== "ADMIN" && order.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  // PENDING 상태만 취소 가능 (관리자는 아무 상태나 가능)
  if (session.user.role !== "ADMIN" && order.status !== "PENDING") {
    return NextResponse.json(
      { error: "접수 상태의 주문만 취소할 수 있습니다." },
      { status: 400 },
    )
  }

  await prisma.order.update({
    where: { id },
    data: { status: "CANCELLED" },
  })

  return NextResponse.json({ message: "주문이 취소되었습니다." })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { status, paymentStatus } = await request.json()

  const data: Record<string, string> = {}
  if (status) data.status = status
  if (paymentStatus) data.paymentStatus = paymentStatus

  const order = await prisma.order.update({
    where: { id },
    data,
  })

  return NextResponse.json(order)
}
