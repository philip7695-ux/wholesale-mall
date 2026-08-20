import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { GRADE_DISCOUNT, GRADE_THRESHOLDS } from "@/lib/grade"
import { apiRoute } from "@/lib/api-route"

async function GET_impl() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { buyerGrade: true },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // SHIPPED 주문의 누적 금액을 KRW 로 환산해 합산한다.
  // totalAmount 는 주문 당시 고객 통화로 저장되고, exchangeRate 는
  // "1 통화단위 = N KRW" 이므로 KRW = totalAmount * exchangeRate.
  // 승급 로직(checkAndPromoteGrade)과 반드시 같은 방식이어야 화면과
  // 실제 등급이 어긋나지 않는다.
  const shippedOrders = await prisma.order.findMany({
    where: { userId: session.user.id, status: "SHIPPED" },
    select: { totalAmount: true, exchangeRate: true },
  })

  const totalSpendingKRW = shippedOrders.reduce(
    (sum, o) => sum + o.totalAmount * (o.exchangeRate > 0 ? o.exchangeRate : 1),
    0,
  )

  // USD 환율 조회
  const usdRate = await prisma.exchangeRate.findUnique({
    where: { currency: "USD" },
  })

  const rate = usdRate?.rate || 1300
  const totalSpendingUSD = Math.round(totalSpendingKRW / rate)

  const grade = user.buyerGrade
  const discountRate = GRADE_DISCOUNT[grade] || 0

  // 다음 등급 정보
  let nextGrade: string | null = null
  let nextThreshold: number | null = null
  let remaining: number | null = null

  if (grade === "BRONZE") {
    nextGrade = "SILVER"
    nextThreshold = GRADE_THRESHOLDS.SILVER
    remaining = Math.max(0, GRADE_THRESHOLDS.SILVER - totalSpendingUSD)
  } else if (grade === "SILVER") {
    nextGrade = "GOLD"
    nextThreshold = GRADE_THRESHOLDS.GOLD
    remaining = Math.max(0, GRADE_THRESHOLDS.GOLD - totalSpendingUSD)
  }
  // GOLD, VIP는 다음 등급 없음 (VIP는 최고, GOLD→VIP는 수동만)

  return NextResponse.json({
    grade,
    discountRate,
    totalSpendingUSD,
    nextGrade,
    nextThreshold,
    remaining,
  })
}

export const GET = apiRoute(GET_impl, { retry: true })
