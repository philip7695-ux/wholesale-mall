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

export interface ResolvedPaymentInfo {
  method: string
  accountName: string
  accountInfo: string
  bankName: string
  qrCodeUrl: string
  memo: string
}

/**
 * 한 주문의 인보이스에 실을 결제 정보를 결정한다. 인보이스 PDF·메일과
 * 바이어 결제 화면이 모두 같은 값을 보도록 한곳에 모은다.
 *
 *  1) 관리자가 발행 시 고른 값(invoicePaymentMethod)이 있으면 그대로.
 *     원화/외화 계좌, 알리페이, 위챗 중 하나. (중국 출고 → 알리페이 등)
 *  2) 없으면 예전 방식(회원 거래유형 기반 계좌)으로 폴백.
 */
export async function resolveOrderPaymentInfo(order: {
  invoicePaymentMethod?: string | null
  paymentMethod?: string | null
  user?: { tradeType?: string | null } | null
}): Promise<ResolvedPaymentInfo | null> {
  const fetchConfig = (method: string) =>
    prisma.paymentConfig.findUnique({
      where: { method },
      select: { method: true, accountName: true, accountInfo: true, bankName: true, qrCodeUrl: true, memo: true },
    })
  try {
    const chosen = order.invoicePaymentMethod
    if (chosen === "BANK_TRANSFER" || chosen === "BANK_TRANSFER_FOREIGN") {
      const cfg = await fetchConfig(chosen)
      // 원화·외화 모두 은행 이체이므로 라벨은 Bank Transfer 로 통일한다.
      if (cfg) return { ...cfg, method: "BANK_TRANSFER" }
    } else if (chosen === "ALIPAY" || chosen === "WECHAT") {
      const cfg = await fetchConfig(chosen)
      if (cfg) return cfg
    } else if (order.paymentMethod === "BANK_TRANSFER") {
      const bank = await getBankConfigForTrade(order.user?.tradeType)
      if (bank) {
        return {
          method: "BANK_TRANSFER",
          accountName: bank.accountName,
          accountInfo: bank.accountInfo,
          bankName: bank.bankName,
          qrCodeUrl: bank.qrCodeUrl,
          memo: bank.memo,
        }
      }
    } else if (order.paymentMethod) {
      const cfg = await fetchConfig(order.paymentMethod)
      if (cfg) return cfg
    }
  } catch { /* table may not exist */ }
  return null
}
