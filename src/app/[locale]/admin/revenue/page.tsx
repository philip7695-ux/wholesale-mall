export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { Link } from "@/i18n/navigation"
import { getTranslations, getLocale } from "next-intl/server"
import { formatAmountIn } from "@/lib/currency"
import { Prisma } from "@prisma/client"
import { RevenueTrendChart } from "@/components/admin/dashboard-charts"
import { RevenueFilter } from "@/components/admin/revenue-filter"
import {
  addDays,
  formatDateParam,
  resolveRange,
  revenueConditionsSql,
  revenueSummarySql,
} from "@/lib/revenue"

export default async function AdminRevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>
}) {
  const sp = await searchParams
  const t = await getTranslations("admin")
  const locale = await getLocale()

  const range = resolveRange(sp.preset, sp.from, sp.to)
  // 주문마다 통화가 달라 그대로 더할 수 없다. 주문 시점 환율로 원화 환산해 합친다.
  const conditions = revenueConditionsSql(range.from, range.to)

  // 일별이면 MM-DD, 월별이면 YYYY-MM 로 눈금을 찍는다.
  const trendFormat = range.granularity === "day" ? "MM-DD" : "YYYY-MM"

  let summary: { total: number; orders: number }[] = []
  let trendRaw: { label: string; revenue: number }[] = []
  let byBuyer: { userId: string | null; total: number; orders: number }[] = []
  let buyers: { id: string; name: string; businessName: string | null }[] = []
  let dbError = false

  try {
    ;[summary, trendRaw, byBuyer] = await Promise.all([
      prisma.$queryRaw<{ total: number; orders: number }[]>(revenueSummarySql(range.from, range.to)),
      prisma.$queryRaw<{ label: string; revenue: number }[]>(
        Prisma.sql`
          SELECT
            to_char(date_trunc(${range.granularity}, COALESCE("shippedAt", "createdAt")), ${trendFormat}) AS label,
            COALESCE(SUM("totalAmount" * "exchangeRate"), 0)::float8 AS revenue
          FROM mall."Order"
          WHERE ${conditions}
          GROUP BY 1
          ORDER BY MIN(COALESCE("shippedAt", "createdAt")) ASC
        `,
      ),
      prisma.$queryRaw<{ userId: string | null; total: number; orders: number }[]>(
        Prisma.sql`
          SELECT
            "userId",
            COALESCE(SUM("totalAmount" * "exchangeRate"), 0)::float8 AS total,
            COUNT(*)::int AS orders
          FROM mall."Order"
          WHERE ${conditions}
          GROUP BY "userId"
          ORDER BY total DESC
          LIMIT 20
        `,
      ),
    ])

    const ids = byBuyer.map((b) => b.userId).filter((id): id is string => Boolean(id))
    if (ids.length > 0) {
      buyers = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, businessName: true },
      })
    }
  } catch (err) {
    // DB 가 흔들려도 화면 전체가 죽지 않게 한다.
    console.error("Revenue page query failed:", err)
    dbError = true
  }

  const total = summary[0]?.total ?? 0
  const orderCount = summary[0]?.orders ?? 0
  const avg = orderCount > 0 ? Math.round(total / orderCount) : 0
  const trend = trendRaw.map((r) => ({ label: r.label, revenue: Number(r.revenue) }))
  const buyerMap = new Map(buyers.map((b) => [b.id, b]))

  const cards = [
    { label: t("revTotal"), value: formatAmountIn(total, "KRW") },
    { label: t("revOrderCount"), value: String(orderCount) },
    { label: t("revAvgOrder"), value: formatAmountIn(avg, "KRW") },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("revenueTitle")}</h1>
        {/* 어디까지를 매출로 세는지 화면에서 바로 보이게 둔다 */}
        <p className="mt-1 text-sm text-muted-foreground">{t("revenueBasisNote")}</p>
      </div>

      <RevenueFilter
        preset={range.preset}
        from={formatDateParam(range.from)}
        to={formatDateParam(addDays(range.to, -1))}
      />

      {dbError && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {t("revLoadFailed")}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-white p-6 shadow-sm">
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className="mt-2 text-3xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{t("revTrend")}</h2>
        <div className="mt-4">
          {trend.length > 0 ? (
            <RevenueTrendChart data={trend} locale={locale} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">{t("revNoData")}</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{t("revByBuyer")}</h2>
        {byBuyer.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("revNoData")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">{t("revBuyer")}</th>
                  <th className="pb-2 font-medium">{t("dashBusinessName")}</th>
                  <th className="pb-2 text-right font-medium">{t("revOrders")}</th>
                  <th className="pb-2 text-right font-medium">{t("revAmount")}</th>
                </tr>
              </thead>
              <tbody>
                {byBuyer.map((row) => {
                  const buyer = row.userId ? buyerMap.get(row.userId) : undefined
                  return (
                    <tr key={row.userId ?? "deleted"} className="border-b last:border-0">
                      <td className="py-2">
                        {buyer ? (
                          <Link
                            href={`/admin/members/${buyer.id}`}
                            className="text-primary hover:underline"
                          >
                            {buyer.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">{t("revDeletedBuyer")}</span>
                        )}
                      </td>
                      <td className="py-2 text-muted-foreground">{buyer?.businessName ?? "-"}</td>
                      <td className="py-2 text-right">{row.orders}</td>
                      <td className="py-2 text-right font-semibold">
                        {formatAmountIn(row.total, "KRW")}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
