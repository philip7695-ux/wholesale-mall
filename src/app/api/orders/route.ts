import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateOrderNumber } from "@/lib/utils"
import { getExchangeRate, getAllExchangeRates } from "@/lib/currency.server"
import { convertCurrency, getCurrencyForLocale } from "@/lib/currency"
import { GRADE_DISCOUNT } from "@/lib/grade"
import { checkMoq } from "@/lib/moq"
import { notifyAdminNewOrder } from "@/lib/email"
import { getAdminNotificationEmail } from "@/lib/payment-setting.server"

export async function GET() {
  try {
    const session = await auth()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const where = session.user.role === "ADMIN" ? {} : { userId: session.user.id }

    const orders = await prisma.order.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(orders)
  } catch (error) {
    console.error("[GET /api/orders] error:", error)
    return NextResponse.json({ error: "주문 목록을 불러오는 중 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 승인되지 않은 회원은 주문 불가
  if (session.user.approvalStatus !== "APPROVED") {
    return NextResponse.json({ error: "회원 승인 후 주문이 가능합니다." }, { status: 403 })
  }

  try {
    const { recipientName, recipientPhone, shippingAddress, shippingMemo, paymentMethod, locale } =
      await request.json()

    // 통화/환율 스냅샷
    const { currency, rate: exchangeRateValue } = await getExchangeRate(locale || "ko")
    const allRates = await getAllExchangeRates()
    const customerCurrency = getCurrencyForLocale(locale || "ko")

    // Get cart items
    const cartItems = await prisma.cartItem.findMany({
      where: { userId: session.user.id },
      include: {
        variant: {
          include: {
            product: { include: { colors: true } },
            color: true,
            size: true,
          },
        },
      },
    })

    if (cartItems.length === 0) {
      return NextResponse.json({ error: "장바구니가 비어있습니다." }, { status: 400 })
    }

    // 유저 등급 조회 및 할인율 계산
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { buyerGrade: true },
    })
    const buyerGrade = user?.buyerGrade || "BRONZE"
    const gradeDiscount = GRADE_DISCOUNT[buyerGrade] || 0

    // MOQ 검증: 상품별로 그룹화
    const productGroups = new Map<string, typeof cartItems>()
    for (const item of cartItems) {
      const pid = item.variant.productId
      if (!productGroups.has(pid)) productGroups.set(pid, [])
      productGroups.get(pid)!.push(item)
    }

    for (const [, groupItems] of productGroups) {
      const product = (groupItems[0] as any).variant.product
      if (product.moq <= 0 && product.colorMoq <= 0 && !(product.colors as any[]).some((c: any) => c.moq > 0)) {
        continue // MOQ 없는 상품은 건너뜀
      }

      // 색상별 수량 집계
      const colorQuantities: Record<string, number> = {}
      for (const item of groupItems) {
        const cid = item.variant.colorId
        colorQuantities[cid] = (colorQuantities[cid] || 0) + item.quantity
      }

      const moqResult = checkMoq({
        productMoq: product.moq,
        colorMoq: product.colorMoq,
        colors: (product.colors as any[]).map((c: any) => ({
          colorId: c.id,
          colorName: c.name,
          moq: c.moq,
        })),
        quantities: colorQuantities,
        grade: buyerGrade,
      })

      if (!moqResult.valid) {
        const errors: string[] = []
        if (moqResult.productMoqRequired > 0 && moqResult.productQtyTotal < moqResult.productMoqRequired) {
          errors.push(`${product.name}: 최소 ${moqResult.productMoqRequired}장 필요 (현재 ${moqResult.productQtyTotal}장)`)
        }
        for (const ce of moqResult.colorErrors) {
          errors.push(`${product.name} - ${ce.colorName}: 최소 ${ce.required}장 필요 (현재 ${ce.actual}장)`)
        }
        return NextResponse.json(
          { error: `MOQ 미달: ${errors.join(", ")}` },
          { status: 400 },
        )
      }
    }

    // 가격을 고객 통화로 변환하여 주문 저장
    const itemsTotal = cartItems.reduce(
      (sum: any, item: any) => {
        const priceCurrency = item.variant.product.priceCurrency || "KRW"
        const converted = convertCurrency(item.variant.price * item.quantity, priceCurrency, customerCurrency, allRates)
        return sum + converted
      },
      0,
    )
    const totalAmount = gradeDiscount > 0
      ? Math.round(itemsTotal * (1 - gradeDiscount) * 100) / 100
      : Math.round(itemsTotal * 100) / 100

    const order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: session.user.id,
        status: "ORDER_PLACED",
        totalAmount,
        gradeDiscount,
        currency,
        exchangeRate: exchangeRateValue,
        paymentMethod: paymentMethod || "BANK_TRANSFER",
        recipientName,
        recipientPhone,
        shippingAddress,
        shippingMemo,
        items: {
          create: cartItems.map((item: any) => {
            const priceCurrency = item.variant.product.priceCurrency || "KRW"
            const convertedPrice = Math.round(convertCurrency(item.variant.price, priceCurrency, customerCurrency, allRates) * 100) / 100
            return {
              variantId: item.variant.id,
              quantity: item.quantity,
              price: convertedPrice,
              productName: item.variant.product.name,
              colorName: item.variant.color.name,
              sizeName: item.variant.size.name,
            }
          }),
        },
      },
      include: { items: true },
    })

    // Clear cart
    await prisma.cartItem.deleteMany({
      where: { userId: session.user.id },
    })

    // 관리자 이메일 알림 (비동기, 실패해도 주문에 영향 없음)
    getAdminNotificationEmail().then((adminEmail) => {
      if (adminEmail) {
        notifyAdminNewOrder(adminEmail, {
          orderNumber: order.orderNumber,
          customerName: session.user.name || "",
          customerEmail: session.user.email || "",
          totalAmount: order.totalAmount,
          itemCount: order.items.length,
        })
      }
    })

    return NextResponse.json(order, { status: 201 })
  } catch (error) {
    console.error("Order creation error:", error)
    return NextResponse.json(
      { error: "주문 처리 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
