import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkAndPromoteGrade } from "@/lib/grade.server"
import { STATUS_TIMESTAMP_FIELD, isValidStatusTransition, isPrePayment, canBuyerCancel } from "@/lib/order-status"
import { notifyCustomerShipped, notifyCustomerOrderCancelled } from "@/lib/email"
import { apiRoute } from "@/lib/api-route"
import { holdsReservation, releaseReservation, refreshProductStock, isDeductedUnshipped, restoreStock } from "@/lib/order-revision"

async function GET_impl(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) {
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
            include: { product: { select: { thumbnail: true, code: true } } },
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

async function DELETE_impl(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const permanent = searchParams.get("permanent") === "true"
  const isAdmin = session.user.role === "ADMIN"

  // 사유는 본문으로 받는다. DELETE 에 본문이 없을 수도 있으므로 조용히 넘긴다.
  const body = await request.json().catch(() => ({} as any))
  const reason = typeof body?.reason === "string" ? body.reason.trim() : ""

  const order = await prisma.order.findUnique({
    where: { id },
    include: { user: { select: { name: true, email: true } } },
  })

  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
  }

  // 본인 주문이거나 관리자만 가능
  if (!isAdmin && order.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  // 영구 삭제 (관리자 전용)
  if (permanent) {
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }
    // 취소되지 않은 주문을 바로 지우면 바이어 쪽에서 주문이 말없이 사라진다.
    // 먼저 사유와 함께 취소해 바이어가 확인할 수 있게 한 뒤에만 지운다.
    if (order.status !== "CANCELLED") {
      return NextResponse.json(
        { error: "먼저 사유와 함께 취소한 뒤에 삭제할 수 있습니다. 바이어가 취소 사유를 확인해야 합니다." },
        { status: 400 },
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.paymentConfirmation.deleteMany({ where: { orderId: id } })
      await tx.orderItem.deleteMany({ where: { orderId: id } })
      await tx.order.delete({ where: { id } })
    })

    return NextResponse.json({ message: "주문이 삭제되었습니다." })
  }

  if (order.status === "CANCELLED") {
    return NextResponse.json({ error: "이미 취소된 주문입니다." }, { status: 400 })
  }

  // 취소 처리
  // 확정 뒤에는 바이어가 혼자 되돌릴 수 없다. 재고가 이미 빠졌고
  // 양쪽이 합의한 수량이라 담당자와 이야기할 일이다.
  if (!isAdmin && !canBuyerCancel(order.status)) {
    return NextResponse.json(
      { error: "확정된 주문은 직접 취소할 수 없습니다. 담당자에게 문의해주세요." },
      { status: 400 },
    )
  }
  // 관리자가 남의 주문을 취소할 때는 사유를 반드시 남긴다.
  // 바이어가 왜 취소됐는지 알 수 있는 유일한 통로다.
  if (isAdmin && order.userId !== session.user.id && !reason) {
    return NextResponse.json(
      { error: "취소 사유를 입력해주세요. 바이어에게 그대로 전달됩니다." },
      { status: 400 },
    )
  }

  await prisma.$transaction(async (tx) => {
    // 확정 전이면 예약만 풀면 된다. 확정 뒤라면 실재고가 이미 빠졌지만
    // 물건은 아직 창고에 있으므로 도로 넣는다. 출고된 주문(SHIPPED)은
    // 둘 다 아니고, 반품은 실물 확인이 필요한 별도 절차다.
    const releasing = holdsReservation(order.status)
    const restoring = isDeductedUnshipped(order.status)
    if (releasing || restoring) {
      const items = await tx.orderItem.findMany({
        where: { orderId: id },
        select: { variantId: true },
      })
      if (releasing) await releaseReservation(tx, id)
      if (restoring) await restoreStock(tx, id)

      const variantIds = items.map((i) => i.variantId).filter(Boolean) as string[]
      if (variantIds.length) {
        const vs = await tx.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: { productId: true },
        })
        await refreshProductStock(tx, [...new Set(vs.map((v) => v.productId))])
      }
    }

    await tx.order.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason || null,
        cancelledByAdmin: isAdmin && order.userId !== session.user.id,
      },
    })
  })

  // 화면에 남기는 것과 별개로 메일도 보낸다. 바이어가 주문 목록을
  // 다시 열어보지 않아도 알 수 있어야 한다. 실패해도 취소는 유효하다.
  const byAdmin = isAdmin && order.userId !== session.user.id
  if (byAdmin && order.user?.email) {
    notifyCustomerOrderCancelled(order.user.email, {
      orderNumber: order.orderNumber,
      customerName: order.user.name || "",
      reason: reason || "-",
      byAdmin: true,
    }).catch((e) => console.error("[order cancel] email failed:", e))
  }

  return NextResponse.json({ message: "주문이 취소되었습니다." })
}

// 고객용: 배송 정보 및 결제수단 수정
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const order = await prisma.order.findUnique({ where: { id } })

  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
  }

  if (session.user.role !== "ADMIN" && order.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  if (!isPrePayment(order.status)) {
    return NextResponse.json({ error: "입금 전 상태의 주문만 수정할 수 있습니다." }, { status: 400 })
  }

  try {
    const { recipientName, recipientPhone, shippingAddress, shippingMemo, paymentMethod } = await request.json()

    const data: Record<string, string> = {}
    if (recipientName !== undefined) data.recipientName = recipientName
    if (recipientPhone !== undefined) data.recipientPhone = recipientPhone
    if (shippingAddress !== undefined) data.shippingAddress = shippingAddress
    if (shippingMemo !== undefined) data.shippingMemo = shippingMemo
    if (paymentMethod !== undefined) data.paymentMethod = paymentMethod

    const updated = await prisma.order.update({
      where: { id },
      data,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("[PATCH /api/orders] error:", error)
    return NextResponse.json({ error: "수정에 실패했습니다." }, { status: 500 })
  }
}

// 관리자용: 상태/결제상태 변경
async function PUT_impl(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { status, paymentStatus, trackingNumber, shippingCarrier } = await request.json()

  const currentOrder = await prisma.order.findUnique({
    where: { id },
    select: { status: true, paymentStatus: true },
  })

  if (!currentOrder) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
  }

  const data: Record<string, unknown> = {}

  // 결제 상태 변경
  if (paymentStatus) {
    data.paymentStatus = paymentStatus
    // 결제완료 → 주문 상태 자동 PAYMENT_CONFIRMED
    if (paymentStatus === "PAID") {
      if (isPrePayment(currentOrder.status)) {
        data.status = "PAYMENT_CONFIRMED"
        data.paymentConfirmedAt = new Date()
      }
    }
  }

  // 송장번호 입력 → 자동 SHIPPED
  if (trackingNumber !== undefined) data.trackingNumber = trackingNumber
  if (shippingCarrier !== undefined) data.shippingCarrier = shippingCarrier
  if (trackingNumber && trackingNumber.trim() !== "") {
    const effectiveStatus = (data.status as string) || currentOrder.status
    const shippableStatuses = ["PAYMENT_CONFIRMED"]
    if (shippableStatuses.includes(effectiveStatus)) {
      data.status = "SHIPPED"
      data.shippedAt = new Date()
    }
  }

  // 수동 상태 변경 (배송완료, 취소 등 자동 전환 외)
  if (status) {
    // 상태 전이 규칙 검증 (역행·종결상태 부활 차단)
    if (!isValidStatusTransition(currentOrder.status, status)) {
      return NextResponse.json(
        { error: `'${currentOrder.status}' → '${status}' 상태 변경은 허용되지 않습니다.` },
        { status: 400 },
      )
    }
    data.status = status
    const tsField = STATUS_TIMESTAMP_FIELD[status]
    if (tsField && tsField !== "createdAt") {
      data[tsField] = new Date()
    }
  }

  const order = await prisma.order.update({
    where: { id },
    data,
    select: { id: true, userId: true, status: true, paymentStatus: true, orderNumber: true, trackingNumber: true, shippingCarrier: true, user: { select: { name: true, email: true } } },
  })

  // 출하 완료 시 고객 이메일 알림
  if (order.status === "SHIPPED" && order.trackingNumber && order.user) {
    notifyCustomerShipped(order.user.email, {
      orderNumber: order.orderNumber,
      customerName: order.user.name,
      trackingNumber: order.trackingNumber,
      shippingCarrier: order.shippingCarrier || "",
    })
  }

  // SHIPPED로 변경 시 자동 승급 체크
  let promotedGrade: string | null = null
  if (order.status === "SHIPPED" && order.userId) {
    promotedGrade = await checkAndPromoteGrade(order.userId)
  }

  return NextResponse.json({ ...order, promotedGrade })
}

export const GET = apiRoute(GET_impl, { retry: true })
export const DELETE = apiRoute(DELETE_impl, { retry: false })
export const PUT = apiRoute(PUT_impl, { retry: false })
