import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getApiTranslations } from "@/lib/api-i18n"

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
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
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

  const t = await getApiTranslations(request, "api")
  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    select: { userId: true, status: true },
  })

  if (!order) {
    return NextResponse.json({ error: t("orderNotFound") }, { status: 404 })
  }

  if (order.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  if (order.status !== "INVOICE_SENT" && order.status !== "AWAITING_PAYMENT") {
    return NextResponse.json(
      { error: t("paymentNotAvailable") },
      { status: 400 },
    )
  }

  const { receiptImage, transferDate, amount, senderName } = await request.json()

  if (!receiptImage || !transferDate || !amount || !senderName) {
    return NextResponse.json(
      { error: t("allFieldsRequired") },
      { status: 400 },
    )
  }

  // 기존 PENDING 건이 있으면 REJECTED로 변경 (재요청 시나리오)
  await prisma.paymentConfirmation.updateMany({
    where: { orderId: id, status: "PENDING" },
    data: { status: "REJECTED", rejectionReason: "Superseded by new request" },
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

  // 주문 상태를 AWAITING_PAYMENT로 전환
  if (order.status === "INVOICE_SENT") {
    await prisma.order.update({
      where: { id },
      data: {
        status: "AWAITING_PAYMENT",
        awaitingPaymentAt: new Date(),
      },
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

  const t = await getApiTranslations(request, "api")
  const { id } = await params
  const { action, rejectionReason } = await request.json()

  const confirmation = await prisma.paymentConfirmation.findFirst({
    where: { orderId: id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  })

  if (!confirmation) {
    return NextResponse.json(
      { error: t("noPaymentToProcess") },
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

    return NextResponse.json({ message: t("paymentConfirmed") })
  }

  if (action === "reject") {
    await prisma.paymentConfirmation.update({
      where: { id: confirmation.id },
      data: {
        status: "REJECTED",
        rejectionReason: rejectionReason || null,
      },
    })

    return NextResponse.json({ message: t("paymentRejected") })
  }

  return NextResponse.json({ error: t("invalidRequest") }, { status: 400 })
}
