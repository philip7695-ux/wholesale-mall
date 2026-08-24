import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateInvoiceNumber } from "@/lib/utils"
import { buildInvoicePdf, type InvoiceData } from "@/lib/invoice-pdf"
import { convertCurrency } from "@/lib/currency"
import { getAllExchangeRates } from "@/lib/currency.server"
import { notifyCustomerInvoice } from "@/lib/email"
import { resolveOrderPaymentInfo } from "@/lib/payment-setting.server"
import { isEditable } from "@/lib/order-revision"

export async function GET(
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
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          businessName: true,
          businessAddress: true,
          tradeType: true,
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

  const isAdmin = session.user.role === "ADMIN"

  // 인보이스 발행은 관리자 행위. 고객은 이미 발행된 인보이스만 열람 가능.
  // (고객이 인보이스를 여는 것만으로 INVOICE_SENT로 전이되던 부수효과 방지)
  let invoiceNumber = order.invoiceNumber
  if (!invoiceNumber && !isAdmin) {
    return NextResponse.json(
      { error: "아직 인보이스가 발행되지 않았습니다." },
      { status: 404 },
    )
  }
  // 확정 전(수량 조정 가능)에는 발행할 수 없다. 수량이 굳은 뒤라야
  // 인보이스가 의미가 있다. UI 가 막지만 서버에서도 흐름을 강제한다.
  if (!invoiceNumber && isAdmin && isEditable(order.status)) {
    return NextResponse.json(
      { error: "주문을 확정한 뒤에 인보이스를 발행할 수 있습니다." },
      { status: 400 },
    )
  }
  if (!invoiceNumber) {
    invoiceNumber = generateInvoiceNumber()
    try {
      const updated = await prisma.order.update({
        where: { id },
        data: { invoiceNumber },
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

  // 상태 전이는 번호 발급과 따로 본다. 번호가 이미 있는 주문을 다시
  // 내려받는 경우에도 진행 현황이 인보이스 발행에서 멈추면 안 된다.
  //
  // 확정을 거쳐야 인보이스가 나가므로 CONFIRMED 에서만 전이한다.
  // (확정 전 발행은 위에서 이미 막았다)
  if (isAdmin && order.status === "CONFIRMED") {
    await prisma.order.update({
      where: { id },
      data: { status: "INVOICE_SENT", invoiceSentAt: new Date() },
    })
  }

  // 인보이스에 실을 결제 정보. 발행 시 고른 수단(없으면 거래유형 폴백).
  // 바이어 결제 화면과 같은 헬퍼를 써 두 곳이 항상 일치한다.
  const paymentInfo = await resolveOrderPaymentInfo(order)

  // Build invoice data
  // 인보이스 표시 통화: 발행 시 고른 값(invoiceCurrency)이 우선, 없으면 주문 통화.
  // 주문에 저장된 금액은 base 통화(order.currency)이고, 표시만 목표 통화로
  // 환산한다. 데이터는 그대로 두고 인보이스만 그 통화로 나가게 한다.
  const baseCurrency = order.currency || "KRW"
  const currency = order.invoiceCurrency || baseCurrency
  const rates = await getAllExchangeRates()
  const exchangeRate = currency === "KRW" ? 1 : (rates[currency] || order.exchangeRate || 1)

  // PDF 폰트에 특수 통화 기호 글리프가 없으므로 ASCII 안전 기호로 매핑
  const CURRENCY_SYMBOL: Record<string, string> = {
    KRW: "KRW",
    USD: "USD",
    CNY: "CNY",
    JPY: "JPY",
  }
  const formatAmount = (amount: number) => {
    // base 통화 금액을 인보이스 통화로 환산(예: KRW → CNY)
    const converted = convertCurrency(amount, baseCurrency, currency, rates)
    const zeroDp = currency === "KRW" || currency === "JPY"
    const formatted = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: zeroDp ? 0 : 2,
      maximumFractionDigits: zeroDp ? 0 : 2,
    }).format(converted)
    return `${CURRENCY_SYMBOL[currency] ?? currency} ${formatted}`
  }

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
      name: order.user?.name ?? order.deletedUserName ?? "-",
      businessName: order.user?.businessName ?? null,
      address: order.user?.businessAddress ?? null,
      phone: order.user?.phone ?? null,
      email: order.user?.email ?? order.deletedUserEmail ?? "-",
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
    vatRate: order.vatRate,
    vatAmount: order.vatAmount,
    totalAmountKRW: order.totalAmount,
    formatAmount,
    paymentInfo,
    sellerInfo: null as import("@/lib/invoice-pdf").InvoiceSellerInfo | null,
  }

  // StoreConfig에서 회사 정보 조회
  try {
    const sc = await prisma.storeConfig.findUnique({ where: { id: "default" } })
    if (sc && sc.companyName) {
      invoiceData.sellerInfo = {
        companyName: sc.companyName,
        address: sc.address,
        phone: sc.phone,
        email: sc.email,
        footerMessage: sc.footerMessage,
        footerTerms: sc.footerTerms,
      }
    }
  } catch { /* table may not exist */ }

  // 인보이스 최초 생성 시 고객에게 이메일 발송
  if (!order.invoiceNumber && order.user) {
    // 인보이스 PDF 와 같은 계좌 정보를 메일에도 싣는다.
    notifyCustomerInvoice(order.user.email, {
      orderNumber: order.orderNumber,
      invoiceNumber: invoiceNumber!,
      totalAmount: order.totalAmount,
      customerName: order.user.name,
      amountText: formatAmount(order.totalAmount),
    }, {
      bankName: paymentInfo?.bankName,
      accountNumber: paymentInfo?.accountInfo,
      accountHolder: paymentInfo?.accountName,
      bankNote: paymentInfo?.memo,
      alipayQrImage: paymentInfo?.method === "ALIPAY" ? paymentInfo.qrCodeUrl : null,
      wechatQrImage: paymentInfo?.method === "WECHAT" ? paymentInfo.qrCodeUrl : null,
    })
  }

  try {
    const pdfBuffer = await buildInvoicePdf(invoiceData)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=invoice-${invoiceNumber}.pdf`,
      },
    })
  } catch (error: any) {
    console.error("[invoice] PDF generation error:", error)
    return NextResponse.json(
      { error: "PDF 생성 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
