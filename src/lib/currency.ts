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
