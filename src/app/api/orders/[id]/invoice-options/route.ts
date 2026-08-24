import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiRoute } from "@/lib/api-route"
import { applyVat } from "@/lib/trade"
import { SUPPORTED_CURRENCIES } from "@/lib/currency"

const PAYMENT_METHODS = ["BANK_TRANSFER", "BANK_TRANSFER_FOREIGN", "ALIPAY", "WECHAT"] as const

/**
 * 인보이스 발행 옵션 저장(관리자). 발행 직전에 부가세와 결제수단을
 * 골라 넣는다. 모듈형 인보이스의 조립 단계.
 *
 *  - 부가세: 켜고 끄거나 세율을 바꾸면 현재 확정 수량 기준으로 공급가·
 *    세액·총액을 다시 계산한다(수량 조정 결과까지 반영).
 *  - 결제수단: 원화/외화 계좌, 알리페이, 위챗 중 하나를 인보이스에 싣는다.
 *
 * 이미 발행된(invoiceNumber 있는) 주문은 바이어가 사본을 받았으므로
 * 옵션을 다시 바꾸지 않는다.
 */
async function PUT_impl(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const vatRate = Number(body.vatRate)
  const invoicePaymentMethod = body.invoicePaymentMethod as string | undefined
  const invoiceCurrency = body.invoiceCurrency as string | undefined

  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 1) {
    return NextResponse.json({ error: "세율이 올바르지 않습니다." }, { status: 400 })
  }
  if (invoicePaymentMethod && !PAYMENT_METHODS.includes(invoicePaymentMethod as (typeof PAYMENT_METHODS)[number])) {
    return NextResponse.json({ error: "결제수단이 올바르지 않습니다." }, { status: 400 })
  }
  if (invoiceCurrency && !SUPPORTED_CURRENCIES.includes(invoiceCurrency as (typeof SUPPORTED_CURRENCIES)[number])) {
    return NextResponse.json({ error: "통화가 올바르지 않습니다." }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  })
  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
  }
  if (order.invoiceNumber) {
    return NextResponse.json(
      { error: "이미 발행된 인보이스는 옵션을 바꿀 수 없습니다." },
      { status: 400 },
    )
  }

  // 현재 확정 수량 기준으로 다시 계산한다. 아이템 단가는 이미 등급할인이
  // 반영된 값이므로 그 합이 공급가액이 된다.
  const supply = order.items.reduce((sum, it) => sum + it.price * it.quantity, 0)
  const { supplyAmount, vatAmount, totalAmount } = applyVat(supply, vatRate)

  const updated = await prisma.order.update({
    where: { id },
    data: {
      vatRate,
      vatAmount,
      supplyAmount,
      totalAmount,
      ...(invoicePaymentMethod ? { invoicePaymentMethod } : {}),
      // 통화는 base 금액을 바꾸지 않고 인보이스 표시 통화만 지정한다.
      ...(invoiceCurrency ? { invoiceCurrency } : {}),
    },
  })

  return NextResponse.json(updated)
}

export const PUT = apiRoute(PUT_impl, { retry: false })
