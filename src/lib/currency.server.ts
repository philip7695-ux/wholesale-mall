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
