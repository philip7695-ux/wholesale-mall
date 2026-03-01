import { prisma } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"
import { ExchangeRateForm } from "@/components/admin/exchange-rate-form"

export const dynamic = "force-dynamic"

export default async function ExchangeRatesPage() {
  const t = await getTranslations("admin")

  const rates = await prisma.exchangeRate.findMany({
    orderBy: { currency: "asc" },
  })

  const rateMap: Record<string, number> = {}
  for (const r of rates) {
    rateMap[r.currency] = r.rate
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("exchangeRateTitle")}</h1>
      <ExchangeRateForm initialRates={rateMap} />
    </div>
  )
}
