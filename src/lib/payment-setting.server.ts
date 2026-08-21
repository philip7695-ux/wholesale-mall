import "server-only"
import { prisma } from "@/lib/prisma"

export async function getPaymentSetting() {
  return prisma.paymentSetting.findFirst()
}

export async function getAdminNotificationEmail() {
  const setting = await prisma.paymentSetting.findFirst({
    select: { notificationEmail: true },
  })
  if (setting?.notificationEmail) return setting.notificationEmail

  // 폴백: 첫 번째 ADMIN 유저 이메일
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { email: true },
  })
  return admin?.email || null
}

/**
 * 회원의 거래유형(국내/수출)에 맞는 계좌이체 계좌를 고른다.
 *   국내(DOMESTIC) → 원화 계좌(BANK_TRANSFER)
 *   수출(EXPORT)   → 외화 계좌(BANK_TRANSFER_FOREIGN)
 * 외화 계좌가 비어 있으면 원화 계좌로 폴백한다(설정 전 안전장치).
 */
export async function getBankConfigForTrade(tradeType: string | null | undefined) {
  const [domestic, foreign] = await Promise.all([
    prisma.paymentConfig.findUnique({ where: { method: "BANK_TRANSFER" } }),
    prisma.paymentConfig.findUnique({ where: { method: "BANK_TRANSFER_FOREIGN" } }),
  ])
  const useForeign = tradeType === "EXPORT" && foreign && foreign.accountInfo.trim() !== ""
  return useForeign ? foreign : domestic
}
