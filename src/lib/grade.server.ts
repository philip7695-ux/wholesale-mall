import "server-only"
import { prisma } from "@/lib/prisma"
import {
  calculateGrade,
  GRADE_DISCOUNT,
  GRADE_MOQ_RATE,
  GRADE_THRESHOLDS,
  type GradeConfigData,
} from "@/lib/grade"

// DB에서 등급 설정 조회, 없으면 기본값
export async function getGradeConfig(): Promise<GradeConfigData[]> {
  const configs = await prisma.gradeConfig.findMany({
    orderBy: { grade: "asc" },
  })

  if (configs.length > 0) return configs

  return ["BRONZE", "SILVER", "GOLD", "VIP"].map((grade) => ({
    grade,
    discountRate: GRADE_DISCOUNT[grade] ?? 0,
    moqRate: GRADE_MOQ_RATE[grade] ?? 1.0,
    threshold: GRADE_THRESHOLDS[grade] ?? 0,
  }))
}

// DB 설정 기반으로 할인율 조회
export async function getGradeDiscount(grade: string): Promise<number> {
  const config = await prisma.gradeConfig.findUnique({ where: { grade } })
  return config?.discountRate ?? GRADE_DISCOUNT[grade] ?? 0
}

// DB 설정 기반으로 MOQ 비율 조회
export async function getGradeMoqRate(grade: string): Promise<number> {
  const config = await prisma.gradeConfig.findUnique({ where: { grade } })
  return config?.moqRate ?? GRADE_MOQ_RATE[grade] ?? 1.0
}

export async function checkAndPromoteGrade(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { buyerGrade: true },
  })

  if (!user) return null

  // VIP는 자동 승급 불가
  if (user.buyerGrade === "VIP") return null

  // SHIPPED 주문의 누적 금액 (KRW로 환산하여 합산)
  // 주의: order.totalAmount는 주문 당시 고객 통화로 저장되고,
  // order.exchangeRate는 "1 통화단위 = N KRW" 이므로 KRW = totalAmount * exchangeRate.
  const shippedOrders = await prisma.order.findMany({
    where: { userId, status: "SHIPPED" },
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

  const rate = usdRate?.rate || 1300 // 기본값

  const newGrade = calculateGrade(totalSpendingKRW, rate, user.buyerGrade)

  if (newGrade !== user.buyerGrade) {
    await prisma.user.update({
      where: { id: userId },
      data: { buyerGrade: newGrade as any },
    })
    return newGrade
  }

  return null
}
