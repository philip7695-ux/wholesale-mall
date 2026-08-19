import { getCurrencyForLocale } from "@/lib/currency"

/**
 * 거래 유형에 따라 통화와 부가세를 결정한다.
 *
 * 통화가 접속 언어를 따라가면, 영어로 보는 국내 거래 고객(예: 한국
 * 물류회사가 대리 결제하는 해외 바이어)에게 달러로 청구된다. 언어는
 * 보기 편한 언어일 뿐이고, 통화와 세금은 거래 형태가 정한다.
 *
 * 국내 거래: KRW + 부가세 10% (도매가가 부가세 별도이므로 더해야 한다)
 * 수출     : 지정 통화(없으면 언어 기본값) + 영세율
 */

export type TradeType = "DOMESTIC" | "EXPORT"

/** 국내 부가세율. 주문에는 스냅샷으로 남겨 나중에 세율이 바뀌어도 과거 주문이 흔들리지 않게 한다. */
export const VAT_RATE = 0.1

export interface TradeTerms {
  currency: string
  vatRate: number
}

export function resolveTradeTerms(
  user: { tradeType?: TradeType | null; currency?: string | null } | null | undefined,
  locale: string,
): TradeTerms {
  const tradeType = user?.tradeType ?? "DOMESTIC"
  if (tradeType === "DOMESTIC") {
    return { currency: "KRW", vatRate: VAT_RATE }
  }
  return {
    currency: user?.currency || getCurrencyForLocale(locale),
    vatRate: 0,
  }
}

/** 공급가액에서 부가세와 합계를 낸다. 통화별 소수 자릿수는 호출부에서 맞춘다. */
export function applyVat(supplyAmount: number, vatRate: number) {
  const vatAmount = Math.round(supplyAmount * vatRate * 100) / 100
  return {
    supplyAmount: Math.round(supplyAmount * 100) / 100,
    vatAmount,
    totalAmount: Math.round((supplyAmount + vatAmount) * 100) / 100,
  }
}
