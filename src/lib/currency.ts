const localeCurrencyMap: Record<string, string> = {
  ko: "KRW",
  en: "USD",
  zh: "CNY",
  ja: "JPY",
}

const currencyConfig: Record<string, { locale: string; minimumFractionDigits: number }> = {
  KRW: { locale: "ko-KR", minimumFractionDigits: 0 },
  USD: { locale: "en-US", minimumFractionDigits: 2 },
  CNY: { locale: "zh-CN", minimumFractionDigits: 2 },
  JPY: { locale: "ja-JP", minimumFractionDigits: 0 },
}

export const SUPPORTED_CURRENCIES = ["KRW", "USD", "CNY"] as const

export function getCurrencyForLocale(locale: string): string {
  return localeCurrencyMap[locale] || "KRW"
}

/** 기존 호환: KRW → target 변환 (rate = KRW per 1 target) */
export function convertPrice(priceKRW: number, rate: number): number {
  if (rate <= 0 || rate === 1) return priceKRW
  return priceKRW / rate
}

/**
 * 크로스 통화 변환
 * rates: { USD: 1300, CNY: 180, ... } (= KRW per 1 unit)
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (fromCurrency === toCurrency) return amount
  const fromRate = fromCurrency === "KRW" ? 1 : (rates[fromCurrency] || 1)
  const toRate = toCurrency === "KRW" ? 1 : (rates[toCurrency] || 1)
  return (amount * fromRate) / toRate
}

/** 기존 호환: KRW 가격을 locale 통화로 포맷 */
export function formatCurrency(priceKRW: number, currency: string, rate: number): string {
  const config = currencyConfig[currency] || currencyConfig.KRW
  const converted = convertPrice(priceKRW, rate)
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency,
    minimumFractionDigits: config.minimumFractionDigits,
    maximumFractionDigits: config.minimumFractionDigits,
  }).format(converted)
}

/**
 * 환산 없이 그 통화 형식으로 표시한다.
 *
 * 주문·인보이스처럼 통화가 이미 확정된 금액에 쓴다. 저장된 금액은
 * order.currency 기준이므로, 보는 사람 언어로 환산하면 청구액과 달라진다.
 */
export function formatAmountIn(amount: number, currency: string): string {
  const config = currencyConfig[currency] || currencyConfig.KRW
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency,
    minimumFractionDigits: config.minimumFractionDigits,
    maximumFractionDigits: config.minimumFractionDigits,
  }).format(amount)
}

/** 크로스 통화 포맷: 원본 통화 → 대상 통화로 변환 후 포맷 */
export function formatCurrencyCross(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): string {
  const converted = convertCurrency(amount, fromCurrency, toCurrency, rates)
  const config = currencyConfig[toCurrency] || currencyConfig.KRW
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: toCurrency,
    minimumFractionDigits: config.minimumFractionDigits,
    maximumFractionDigits: config.minimumFractionDigits,
  }).format(converted)
}
