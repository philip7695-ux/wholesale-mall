import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyWiseWebhook } from "@/lib/wise"

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get("x-signature-sha256") ?? ""

  // 1. Verify webhook signature
  if (!verifyWiseWebhook(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  // 2. Test notification - just return 200
  if (request.headers.get("x-test-notification") === "true") {
    return NextResponse.json({ ok: true })
  }

  const deliveryId = request.headers.get("x-delivery-id") ?? ""

  // 3. Idempotency check - skip if already processed
  if (deliveryId) {
    const existing = await prisma.wiseWebhookLog.findUnique({
      where: { deliveryId },
    })
    if (existing) {
      return NextResponse.json({ ok: true })
    }
  }

  let payload: {
    event_type?: string
    data?: {
      resource?: {
        type?: string
        id?: number
        profile_id?: number
        amount?: number
        currency?: string
      }
      // The reference (payment description) can appear at different levels
      // depending on the event structure
      current_state?: string
      occurred_at?: string
    }
    // For balances#credit, reference can be at the top-level data
    // or nested within the transaction details
  }

  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: true }) // Always 200 to prevent retries
  }

  const eventType = payload.event_type ?? ""

  // 4. Only process balances#credit events
  if (eventType !== "balances#credit") {
    await prisma.wiseWebhookLog.create({
      data: {
        deliveryId: deliveryId || `unknown-${Date.now()}`,
        eventType,
        payload: rawBody,
        matched: false,
        error: "Ignored event type",
      },
    })
    return NextResponse.json({ ok: true })
  }

  // 5. Extract reference from payload
  // Wise balances#credit webhook includes transaction details
  // Reference field contains the payment description/reference
  const transactionData = payload.data as Record<string, unknown> | undefined
  const details = transactionData?.details as Record<string, unknown> | undefined
  const reference =
    (transactionData?.reference as string | undefined) ??
    (details?.reference as string | undefined) ??
    ""

  // 6. Try to match invoice number pattern (INV-...)
  const invoiceMatch = reference.match(/INV-[\w-]+/i)
  const invoiceNumber = invoiceMatch ? invoiceMatch[0].toUpperCase() : null

  if (!invoiceNumber) {
    await prisma.wiseWebhookLog.create({
      data: {
        deliveryId: deliveryId || `unknown-${Date.now()}`,
        eventType,
        payload: rawBody,
        matched: false,
        error: `No invoice number found in reference: "${reference}"`,
      },
    })
    return NextResponse.json({ ok: true })
  }

  // 7. Find matching order
  const order = await prisma.order.findFirst({
    where: { invoiceNumber },
  })

  if (!order) {
    await prisma.wiseWebhookLog.create({
      data: {
        deliveryId: deliveryId || `unknown-${Date.now()}`,
        eventType,
        payload: rawBody,
        matched: false,
        error: `No order found for invoice: ${invoiceNumber}`,
      },
    })
    return NextResponse.json({ ok: true })
  }

  // 8. Check if order is in a state that can be auto-confirmed
  const confirmableStatuses = ["ORDER_PLACED", "INVOICE_SENT", "AWAITING_PAYMENT"] as const
  if (
    !confirmableStatuses.includes(
      order.status as (typeof confirmableStatuses)[number]
    )
  ) {
    await prisma.wiseWebhookLog.create({
      data: {
        deliveryId: deliveryId || `unknown-${Date.now()}`,
        eventType,
        payload: rawBody,
        matched: true,
        orderId: order.id,
        error: `Order already in status: ${order.status}`,
      },
    })
    return NextResponse.json({ ok: true })
  }

  // 9. Auto-confirm payment in a transaction
  const amount = payload.data?.resource?.amount ?? 0

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAYMENT_CONFIRMED",
        paymentStatus: "PAID",
        paymentConfirmedAt: new Date(),
      },
    }),
    prisma.paymentConfirmation.create({
      data: {
        orderId: order.id,
        receiptImage: "",
        transferDate: new Date(),
        amount: Math.round(amount),
        senderName: "wise_auto",
        status: "CONFIRMED",
      },
    }),
    prisma.wiseWebhookLog.create({
      data: {
        deliveryId: deliveryId || `unknown-${Date.now()}`,
        eventType,
        payload: rawBody,
        matched: true,
        orderId: order.id,
      },
    }),
  ])

  return NextResponse.json({ ok: true })
}
