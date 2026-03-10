import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notifyAdminPaymentSubmitted, notifyCustomerPaymentConfirmed } from "@/lib/email"
import { getAdminNotificationEmail } from "@/lib/payment-setting.server"

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
    select: { userId: true },
  })

  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
  }

  if (session.user.role !== "ADMIN" && order.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const confirmation = await prisma.paymentConfirmation.findFirst({
    where: { orderId: id },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(confirmation)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    select: { userId: true, status: true },
  })

  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
  }

  if (order.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  if (order.status !== "INVOICE_SENT") {
    return NextResponse.json(
      { error: "입금 확인 요청이 불가능한 상태입니다." },
      { status: 400 },
    )
  }

  const { receiptImage, transferDate, amount, senderName } = await request.json()

  if (!receiptImage || !transferDate || !amount || !senderName) {
    return NextResponse.json(
      { error: "모든 필드를 입력해주세요." },
      { status: 400 },
    )
  }

  // 기존 PENDING 건이 있으면 REJECTED로 변경 (재요청 시나리오)
  await prisma.paymentConfirmation.updateMany({
    where: { orderId: id, status: "PENDING" },
    data: { status: "REJECTED", rejectionReason: "새 요청으로 대체됨" },
  })

  const confirmation = await prisma.paymentConfirmation.create({
    data: {
      orderId: id,
      receiptImage,
      transferDate: new Date(transferDate),
      amount: Number(amount),
      senderName,
    },
  })

  // 관리자에게 이메일 알림
  const orderForNotify = await prisma.order.findUnique({
    where: { id },
    select: { orderNumber: true, user: { select: { name: true } } },
  })
  if (orderForNotify) {
    getAdminNotificationEmail().then((adminEmail) => {
      if (adminEmail) {
        notifyAdminPaymentSubmitted(adminEmail, {
          orderNumber: orderForNotify.orderNumber,
          customerName: orderForNotify.user.name,
          amount: Number(amount),
          senderName,
        })
      }
    })
  }

  return NextResponse.json(confirmation)
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
  const { action, rejectionReason } = await request.json()

  const confirmation = await prisma.paymentConfirmation.findFirst({
    where: { orderId: id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  })

  if (!confirmation) {
    return NextResponse.json(
      { error: "처리할 입금 확인 요청이 없습니다." },
      { status: 404 },
    )
  }

  if (action === "confirm") {
    await prisma.$transaction([
      prisma.paymentConfirmation.update({
        where: { id: confirmation.id },
        data: { status: "CONFIRMED" },
      }),
      prisma.order.update({
        where: { id },
        data: {
          status: "PAYMENT_CONFIRMED",
          paymentStatus: "PAID",
          paymentConfirmedAt: new Date(),
        },
      }),
    ])

    // 고객에게 결제 확인 이메일
    const confirmedOrder = await prisma.order.findUnique({
      where: { id },
      select: { orderNumber: true, user: { select: { name: true, email: true } } },
    })
    if (confirmedOrder) {
      notifyCustomerPaymentConfirmed(confirmedOrder.user.email, {
        orderNumber: confirmedOrder.orderNumber,
        customerName: confirmedOrder.user.name,
      })
    }

    return NextResponse.json({ message: "입금이 확인되었습니다." })
  }

  if (action === "reject") {
    await prisma.paymentConfirmation.update({
      where: { id: confirmation.id },
      data: {
        status: "REJECTED",
        rejectionReason: rejectionReason || null,
      },
    })

    return NextResponse.json({ message: "입금이 반려되었습니다." })
  }

  return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
}
