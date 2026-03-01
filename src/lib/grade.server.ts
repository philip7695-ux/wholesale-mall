import "server-only"
import { prisma } from "@/lib/prisma"
import { calculateGrade } from "@/lib/grade"

export async function checkAndPromoteGrade(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { buyerGrade: true },
  })

  if (!user) return null

  // VIP는 자동 승급 불가
  if (user.buyerGrade === "VIP") return null

  // DELIVERED 주문의 누적 금액 (KRW)
  const result = await prisma.order.aggregate({
    where: { userId, status: "DELIVERED" },
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
