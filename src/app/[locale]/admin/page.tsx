export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { Link } from "@/i18n/navigation"
import { getTranslations, getLocale } from "next-intl/server"
import { formatPrice, formatDateTime } from "@/lib/utils"
import { MonthlyRevenueChart, GradeDistributionChart } from "@/components/admin/dashboard-charts"
import { WiseBalanceWidget } from "@/components/admin/wise-balance-widget"
import { isWiseConfigured } from "@/lib/wise"
import { Prisma } from "@prisma/client"

const STATUS_COLORS: Record<string, string> = {
  ORDER_PLACED: "bg-gray-100 text-gray-700",
  INVOICE_SENT: "bg-blue-100 text-blue-700",
  AWAITING_PAYMENT: "bg-yellow-100 text-yellow-700",
  PAYMENT_CONFIRMED: "bg-cyan-100 text-cyan-700",
  PREPARING: "bg-purple-100 text-purple-700",
  SHIPPED: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
}

const STATUS_KEYS: Record<string, string> = {
  ORDER_PLACED: "statusReceived",
  INVOICE_SENT: "statusInvoiceSent",
  AWAITING_PAYMENT: "statusAwaitingPayment",
  PAYMENT_CONFIRMED: "statusPaymentConfirmed",
  PREPARING: "statusPreparing",
  SHIPPED: "statusShipped",
  DELIVERED: "statusDelivered",
  CANCELLED: "statusCancelled",
}

export default async function AdminDashboard() {
  const t = await getTranslations("admin")
  const locale = await getLocale()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const notCancelled = { status: { not: "CANCELLED" as const } }

  let productCount = 0, orderCount = 0, memberCount = 0
  let todayRevenue: any = { _sum: { totalAmount: 0 } }
  let weekRevenue: any = { _sum: { totalAmount: 0 } }
  let monthRevenue: any = { _sum: { totalAmount: 0 } }
  let ordersByStatus: any[] = []
  let pendingPayments = 0
  let topProducts: any[] = []
  let pendingApproval = 0
  let gradeDistribution: any[] = []
  let recentBuyers: any[] = []
  let recentOrders: any[] = []
  let wiseConfig: any = null
  let monthlyRevenueRaw: { month: string; revenue: bigint }[] = []

  try {
    ;[
      productCount,
      orderCount,
      memberCount,
      todayRevenue,
      weekRevenue,
      monthRevenue,
      ordersByStatus,
      pendingPayments,
      topProducts,
      pendingApproval,
      gradeDistribution,
      recentBuyers,
      recentOrders,
      wiseConfig,
      monthlyRevenueRaw,
    ] = await Promise.all([
      // 기존 카운트
      prisma.product.count(),
      prisma.order.count(),
      prisma.user.count({ where: { role: "BUYER" } }),

      // 매출 현황 (CANCELLED 제외)
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { ...notCancelled, createdAt: { gte: todayStart } },
      }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { ...notCancelled, createdAt: { gte: weekStart } },
      }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { ...notCancelled, createdAt: { gte: monthStart } },
      }),

      // 주문 상태별 건수
      prisma.order.groupBy({
        by: ["status"],
        _count: true,
      }),

      // 입금 확인 대기
      prisma.paymentConfirmation.count({ where: { status: "PENDING" } }),

      // 인기 상품 Top 5 (최근 30일, CANCELLED 제외)
      prisma.orderItem.groupBy({
        by: ["productName"],
        _sum: { quantity: true },
        where: {
          order: {
            createdAt: { gte: thirtyDaysAgo },
            status: { not: "CANCELLED" },
          },
        },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),

      // 바이어 승인 대기
      prisma.user.count({ where: { role: "BUYER", approvalStatus: "PENDING" } }),

      // 등급별 분포
      prisma.user.groupBy({
        by: ["buyerGrade"],
        _count: true,
        where: { role: "BUYER", approvalStatus: "APPROVED" },
      }),

      // 최근 활동 바이어 (7일 내 주문)
      prisma.user.findMany({
        where: {
          role: "BUYER",
          orders: { some: { createdAt: { gte: sevenDaysAgo } } },
        },
        select: {
          id: true,
          name: true,
          businessName: true,
          _count: { select: { orders: true } },
        },
        take: 5,
        orderBy: { orders: { _count: "desc" } },
      }),

      // 최근 주문 10건
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true, email: true, businessName: true } } },
      }),

      // Wise 설정 존재 여부
      prisma.wiseConfig.findFirst({ select: { id: true } }),

      // 월별 매출 (최근 6개월) - raw SQL
      prisma.$queryRaw<{ month: string; revenue: bigint }[]>(
        Prisma.sql`
          SELECT
            to_char("createdAt", 'YYYY-MM') as month,
            COALESCE(SUM("totalAmount"), 0) as revenue
          FROM "Order"
          WHERE "status" != 'CANCELLED'
            AND "createdAt" >= ${sixMonthsAgo}
          GROUP BY to_char("createdAt", 'YYYY-MM')
          ORDER BY month ASC
        `
      ),
    ])
  } catch (err) {
    console.error("[AdminDashboard] DB error:", err)
    throw err
  }

  // 월별 매출 데이터 가공
  const monthlyRevenue = monthlyRevenueRaw.map((row) => ({
    month: row.month,
    revenue: Number(row.revenue),
  }))

  // 등급별 분포 데이터 가공
  const gradeData = (["BRONZE", "SILVER", "GOLD", "VIP"] as const).map((grade) => ({
    grade,
    count: gradeDistribution.find((g) => g.buyerGrade === grade)?._count ?? 0,
  }))

  // 주문 상태별 맵
  const statusMap = Object.fromEntries(
    ordersByStatus.map((s) => [s.status, s._count])
  ) as Record<string, number>

  const stats = [
    { label: t("totalProducts"), value: productCount, href: "/admin/products" },
    { label: t("totalOrders"), value: orderCount, href: "/admin/orders" },
    { label: t("totalMembers"), value: memberCount, href: "/admin/members" },
    {
      label: t("dashPendingApproval"),
      value: pendingApproval,
      href: "/admin/members",
      highlight: pendingApproval > 0,
    },
  ]

  const revenueItems = [
    { label: t("dashToday"), value: todayRevenue._sum.totalAmount ?? 0 },
    { label: t("dashThisWeek"), value: weekRevenue._sum.totalAmount ?? 0 },
    { label: t("dashThisMonth"), value: monthRevenue._sum.totalAmount ?? 0 },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("dashboard")}</h1>

      {/* 통계 카드 4개 */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className={`rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${
              stat.highlight ? "border-orange-300 bg-orange-50" : ""
            }`}
          >
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className={`mt-2 text-3xl font-bold ${stat.highlight ? "text-orange-600" : ""}`}>
              {stat.value}
            </p>
          </Link>
        ))}
      </div>

      {/* Wise 잔액 위젯 */}
      {wiseConfig && isWiseConfigured() && (
        <div className="mt-6">
          <WiseBalanceWidget />
        </div>
      )}

      {/* 매출 현황 + 주문 현황 */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 매출 현황 카드 */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{t("dashRevenue")}</h2>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {revenueItems.map((item) => (
              <div key={item.label}>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-lg font-bold">{formatPrice(item.value, locale)}</p>
              </div>
            ))}
          </div>
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-muted-foreground">{t("dashMonthlyTrend")}</p>
            {monthlyRevenue.length > 0 ? (
              <MonthlyRevenueChart data={monthlyRevenue} locale={locale} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">{t("dashNoData")}</p>
            )}
          </div>
        </div>

        {/* 주문 현황 카드 */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{t("dashOrderStatus")}</h2>
          <div className="mt-4 space-y-2">
            {(
              [
                "ORDER_PLACED",
                "INVOICE_SENT",
                "AWAITING_PAYMENT",
                "PAYMENT_CONFIRMED",
                "PREPARING",
                "SHIPPED",
                "DELIVERED",
                "CANCELLED",
              ] as const
            ).map((status) => (
              <div key={status} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-gray-50">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>
                  {t(STATUS_KEYS[status])}
                </span>
                <span className="text-sm font-semibold">{t("dashStatusCount", { count: statusMap[status] ?? 0 })}</span>
              </div>
            ))}
          </div>

          {/* 입금 확인 대기 알림 */}
          {pendingPayments > 0 && (
            <div className="mt-4 rounded-md border border-yellow-300 bg-yellow-50 p-3">
              <p className="text-sm font-medium text-yellow-800">
                {t("dashPendingPayment")}: {t("dashPendingPaymentCount", { count: pendingPayments })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 인기 상품 + 바이어 현황 */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 인기 상품 Top 5 */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{t("dashTopProducts")}</h2>
          {topProducts.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">{t("dashNoData")}</p>
          ) : (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">{t("dashRank")}</th>
                  <th className="pb-2 font-medium">{t("dashProductName")}</th>
                  <th className="pb-2 text-right font-medium">{t("dashTotalQty")}</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((item, idx) => (
                  <tr key={item.productName} className="border-b last:border-0">
                    <td className="py-2 font-bold text-muted-foreground">{idx + 1}</td>
                    <td className="py-2">{item.productName}</td>
                    <td className="py-2 text-right font-semibold">{item._sum.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* 바이어 현황 */}
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">{t("dashBuyerStatus")}</h2>

          {/* 등급별 분포 */}
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">{t("dashGradeDistribution")}</p>
            <GradeDistributionChart data={gradeData} />
          </div>

          {/* 최근 활동 바이어 */}
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-muted-foreground">{t("dashRecentBuyers")}</p>
            {recentBuyers.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashNoData")}</p>
            ) : (
              <ul className="space-y-2">
                {recentBuyers.map((buyer) => (
                  <li key={buyer.id} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-gray-50">
                    <div>
                      <span className="text-sm font-medium">{buyer.name}</span>
                      {buyer.businessName && (
                        <span className="ml-2 text-xs text-muted-foreground">{buyer.businessName}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t("dashOrderCount", { count: buyer._count.orders })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* 최근 주문 테이블 */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold">{t("dashRecentOrdersTitle")}</h2>
        {recentOrders.length === 0 ? (
          <p className="mt-4 text-muted-foreground">{t("noOrders")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium">{t("orderNumber")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("orderer")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("dashBusinessName")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("amount")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("status")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("dateTime")}</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${order.id}`} className="text-primary hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{order.user.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{order.user.businessName ?? "-"}</td>
                    <td className="px-4 py-3 text-right">{formatPrice(order.totalAmount, locale)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[order.status]}`}>
                        {t(STATUS_KEYS[order.status])}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDateTime(order.createdAt, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
