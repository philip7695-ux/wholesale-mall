import { prisma } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"
import { SeasonDiscountForm } from "@/components/admin/season-discount-form"
import { getSeasonRates } from "@/lib/pricing.server"
import { getGradeConfig } from "@/lib/grade.server"
import { seasonsNewestFirst } from "@/lib/season"

export const dynamic = "force-dynamic"

export default async function PricingSettingsPage() {
  const t = await getTranslations("admin")

  const [rates, grades, counts] = await Promise.all([
    getSeasonRates(),
    getGradeConfig().catch(() => []),
    // 상품이 없는 시즌은 굳이 줄을 만들지 않는다
    prisma
      .$queryRaw<{ key: string; n: bigint }[]>`
        select substring(code from 3 for 2) as key, count(*) as n
        from mall."Product"
        where code is not null
        group by 1`
      .catch(() => [] as { key: string; n: bigint }[]),
  ])

  const countMap = Object.fromEntries(counts.map((c: { key: string; n: bigint }) => [c.key, Number(c.n)]))

  const rows = seasonsNewestFirst()
    .filter((s) => countMap[s.key] > 0)
    .map((s) => ({
      key: s.key,
      label: s.label,
      rate: rates[s.key] ?? 0,
      productCount: countMap[s.key],
    }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("pricingSettings")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("pricingDesc")}</p>
      </div>

      <SeasonDiscountForm
        rows={rows}
        gradeRates={grades.map((g: any) => ({ grade: g.grade, rate: g.discountRate }))}
      />
    </div>
  )
}
