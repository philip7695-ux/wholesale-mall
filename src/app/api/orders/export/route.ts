import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getApiTranslations } from "@/lib/api-i18n"
import * as XLSX from "xlsx"

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const ta = await getApiTranslations(request, "admin")

  const statusLabels: Record<string, string> = {
    ORDER_PLACED: ta("orderStatusOrderPlaced"),
    INVOICE_SENT: ta("orderStatusInvoiceSent"),
    AWAITING_PAYMENT: ta("orderStatusAwaitingPayment"),
    PAYMENT_CONFIRMED: ta("orderStatusPaymentConfirmed"),
    PREPARING: ta("orderStatusPreparing"),
    SHIPPED: ta("orderStatusShipped"),
    DELIVERED: ta("orderStatusDelivered"),
    CANCELLED: ta("orderStatusCancelled"),
  }

  const paymentLabels: Record<string, string> = {
    PENDING: ta("paymentStatusPending"),
    PAID: ta("paymentStatusPaid"),
    FAILED: ta("paymentStatusFailed"),
    REFUNDED: ta("paymentStatusRefunded"),
  }

  const paymentMethodLabels: Record<string, string> = {
    CARD: "Card",
    BANK_TRANSFER: ta("paymentMethodBankTransfer"),
    VIRTUAL_ACCOUNT: "Virtual Account",
  }

  const idsParam = request.nextUrl.searchParams.get("ids")
  const where = idsParam
    ? { id: { in: idsParam.split(",").filter(Boolean) } }
    : {}

  const orders = await prisma.order.findMany({
    where,
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          businessName: true,
          businessNumber: true,
        },
      },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  })

  const COL = {
    orderNumber: ta("excelOrderNumber"),
    orderDate: ta("excelOrderDate"),
    orderStatus: ta("excelOrderStatus"),
    paymentStatus: ta("excelPaymentStatus"),
    paymentMethod: ta("excelPaymentMethod"),
    orderer: ta("excelOrderer"),
    email: "Email",
    contact: ta("excelContact"),
    business: ta("excelBusiness"),
    bizNumber: "Biz No.",
    receiver: ta("excelReceiver"),
    receiverContact: ta("excelContact"),
    address: ta("excelAddress"),
    memo: ta("excelMemo"),
    product: ta("excelProduct"),
    color: ta("excelColor"),
    size: ta("excelSize"),
    qty: ta("excelQuantity"),
    unitPrice: ta("excelUnitPrice"),
    subtotal: ta("excelAmount"),
    total: "Total",
  }

  const rows = orders.flatMap((order) =>
    order.items.map((item) => ({
      [COL.orderNumber]: order.orderNumber,
      [COL.orderDate]: new Date(order.createdAt).toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
      }),
      [COL.orderStatus]: statusLabels[order.status] || order.status,
      [COL.paymentStatus]: paymentLabels[order.paymentStatus] || order.paymentStatus,
      [COL.paymentMethod]: order.paymentMethod
        ? paymentMethodLabels[order.paymentMethod] || order.paymentMethod
        : "-",
      [COL.orderer]: order.user.name,
      [COL.email]: order.user.email,
      [COL.contact]: order.user.phone || "-",
      [COL.business]: order.user.businessName || "-",
      [COL.bizNumber]: order.user.businessNumber || "-",
      [COL.receiver]: order.recipientName || "-",
      [COL.receiverContact]: order.recipientPhone || "-",
      [COL.address]: order.shippingAddress || "-",
      [COL.memo]: order.shippingMemo || "-",
      [COL.product]: item.productName,
      [COL.color]: item.colorName,
      [COL.size]: item.sizeName,
      [COL.qty]: item.quantity,
      [COL.unitPrice]: item.price,
      [COL.subtotal]: item.price * item.quantity,
      [COL.total]: order.totalAmount,
    })),
  )

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  const colWidths = Object.keys(rows[0] || {}).map((key) => {
    const maxLen = Math.max(
      key.length * 2,
      ...rows.map((r) => String((r as Record<string, unknown>)[key] ?? "").length),
    )
    return { wch: Math.min(maxLen + 2, 40) }
  })
  ws["!cols"] = colWidths

  XLSX.utils.book_append_sheet(wb, ws, ta("excelSheetName"))

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  const today = new Date()
    .toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })
    .replace(/\. /g, "")
    .replace(".", "")
  const filename = `${ta("excelSheetName")}_${today}.xlsx`

  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
