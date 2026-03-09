import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkAndPromoteGrade } from "@/lib/grade.server"
import { STATUS_TIMESTAMP_FIELD } from "@/lib/order-status"

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
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const permanent = searchParams.get("permanent") === "true"

  const order = await prisma.order.findUnique({ where: { id } })

  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
  }

  // 본인 주문이거나 관리자만 가능
  if (session.user.role !== "ADMIN" && order.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  // 영구 삭제 (관리자 전용, 취소된 주문만)
  if (permanent) {
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }
    if (order.status !== "CANCELLED") {
      return NextResponse.json(
        { error: "취소된 주문만 삭제할 수 있습니다." },
        { status: 400 },
      )
    }

    await prisma.orderItem.deleteMany({ where: { orderId: id } })
    await prisma.order.delete({ where: { id } })

    return NextResponse.json({ message: "주문이 삭제되었습니다." })
  }

  // 취소 처리
  if (session.user.role !== "ADMIN" && order.status !== "ORDER_PLACED") {
    return NextResponse.json(
      { error: "접수 상태의 주문만 취소할 수 있습니다." },
      { status: 400 },
    )
  }

  await prisma.order.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
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
  const { status, paymentStatus, trackingNumber, shippingCarrier } = await request.json()

  const data: Record<string, unknown> = {}
  if (status) {
    data.status = status
    // 상태별 타임스탬프 자동 기록
    const tsField = STATUS_TIMESTAMP_FIELD[status]
    if (tsField && tsField !== "createdAt") {
      data[tsField] = new Date()
    }
  }
  if (paymentStatus) data.paymentStatus = paymentStatus
  if (trackingNumber !== undefined) data.trackingNumber = trackingNumber
  if (shippingCarrier !== undefined) data.shippingCarrier = shippingCarrier

  const order = await prisma.order.update({
    where: { id },
    data,
    select: { id: true, userId: true, status: true, paymentStatus: true },
  })

  // DELIVERED로 변경 시 자동 승급 체크
  let promotedGrade: string | null = null
  if (status === "DELIVERED") {
    promotedGrade = await checkAndPromoteGrade(order.userId)
  }

  return NextResponse.json({ ...order, promotedGrade })
}
