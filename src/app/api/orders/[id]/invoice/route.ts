import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateInvoiceNumber } from "@/lib/utils"
import { buildInvoicePdf, type InvoiceData } from "@/lib/invoice-pdf"
import { formatCurrency, getCurrencyForLocale } from "@/lib/currency"

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
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          businessName: true,
          businessAddress: true,
        },
      },
      items: true,
    },
  })

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  // Only allow owner or admin
  if (session.user.role !== "ADMIN" && order.userId !== session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  // Generate invoice number if not exists
  let invoiceNumber = order.invoiceNumber
  if (!invoiceNumber) {
    invoiceNumber = generateInvoiceNumber()
    try {
      const updated = await prisma.order.update({
        where: { id },
        data: {
          invoiceNumber,
          ...(order.status === "ORDER_PLACED"
            ? { status: "INVOICE_SENT", invoiceSentAt: new Date() }
            : {}),
        },
      })
      invoiceNumber = updated.invoiceNumber!
    } catch {
      // Unique constraint race condition - re-fetch
      const refetched = await prisma.order.findUnique({
        where: { id },
        select: { invoiceNumber: true },
      })
      invoiceNumber = refetched?.invoiceNumber ?? invoiceNumber
    }
  }

  // Build invoice data
  const currency = order.currency || "KRW"
  const exchangeRate = order.exchangeRate || 1

  const formatAmount = (amountKRW: number) =>
    formatCurrency(amountKRW, currency, exchangeRate)

  const subtotalKRW = order.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  )
  const discountAmountKRW = Math.round(subtotalKRW * order.gradeDiscount)

  const invoiceData: InvoiceData = {
    invoiceNumber,
    issueDate: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    buyer: {
      name: order.user.name,
      businessName: order.user.businessName,
      address: order.user.businessAddress,
      phone: order.user.phone,
      email: order.user.email,
    },
    items: order.items.map((item) => ({
      productName: item.productName,
      colorName: item.colorName,
      sizeName: item.sizeName,
      quantity: item.quantity,
      unitPrice: item.price,
      subtotal: item.price * item.quantity,
    })),
    currency,
    exchangeRate,
    subtotalKRW,
    gradeDiscount: order.gradeDiscount,
    discountAmountKRW,
    totalAmountKRW: order.totalAmount,
    formatAmount,
  }

  try {
    const pdfBuffer = await buildInvoicePdf(invoiceData)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=invoice-${invoiceNumber}.pdf`,
      },
    })
  } catch (error) {
    console.error("[invoice] PDF generation error:", error)
    return NextResponse.json({ error: "PDF 생성 중 오류가 발생했습니다." }, { status: 500 })
  }
}
