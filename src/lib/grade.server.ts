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

  // SHIPPED 주문의 누적 금액 (KRW)
  const result = await prisma.order.aggregate({
    where: { userId, status: "SHIPPED" },
    _sum: { totalAmount: true },
  })

  const totalSpendingKRW = result._sum.totalAmount || 0

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
