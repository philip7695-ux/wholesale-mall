import "server-only"
import { prisma } from "@/lib/prisma"
import { getCurrencyForLocale } from "@/lib/currency"

export async function getExchangeRate(locale: string): Promise<{ currency: string; rate: number }> {
  const currency = getCurrencyForLocale(locale)
  if (currency === "KRW") return { currency, rate: 1 }

  try {
    const record = await prisma.exchangeRate.findUnique({
      where: { currency },
    })
    return { currency, rate: record?.rate || 1 }
  } catch {
    return { currency, rate: 1 }
  }
}

/** 모든 환율을 { USD: 1300, CNY: 180, ... } 형태로 반환 */
export async function getAllExchangeRates(): Promise<Record<string, number>> {
  try {
    const records = await prisma.exchangeRate.findMany()
    const rates: Record<string, number> = { KRW: 1 }
    for (const r of records) {
      rates[r.currency] = r.rate
    }
    return rates
  } catch {
    return { KRW: 1 }
  }
}
