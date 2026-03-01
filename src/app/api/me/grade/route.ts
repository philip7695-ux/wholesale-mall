import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { GRADE_DISCOUNT, GRADE_THRESHOLDS } from "@/lib/grade"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { buyerGrade: true },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // DELIVERED 주문의 누적 금액 (KRW)
  const result = await prisma.order.aggregate({
    where: { userId: session.user.id, status: "DELIVERED" },
    _sum: { totalAmount: true },
  })

  const totalSpendingKRW = result._sum.totalAmount || 0

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
