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

export function getCurrencyForLocale(locale: string): string {
  return localeCurrencyMap[locale] || "KRW"
}

export function convertPrice(priceKRW: number, rate: number): number {
  if (rate <= 0 || rate === 1) return priceKRW
  return priceKRW / rate
}

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
