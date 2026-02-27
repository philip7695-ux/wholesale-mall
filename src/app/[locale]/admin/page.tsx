export const dynamic = 'force-dynamic'

import { prisma } from "@/lib/prisma"
import { Link } from "@/i18n/navigation"
import { getTranslations, getLocale } from "next-intl/server"
import { formatPrice, formatDate } from "@/lib/utils"

export default async function AdminDashboard() {
  const t = await getTranslations("admin")
  const locale = await getLocale()

  const [productCount, orderCount, memberCount, recentOrders] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.user.count({ where: { role: "BUYER" } }),
    prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, email: true } } },
    }),
  ])

  const stats = [
    { label: t("totalProducts"), value: productCount, href: "/admin/products" },
    { label: t("totalOrders"), value: orderCount, href: "/admin/orders" },
    { label: t("totalMembers"), value: memberCount, href: "/admin/members" },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold">{t("dashboard")}</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="rounded-lg border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-3xl font-bold">{stat.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">{t("recentOrders")}</h2>
        {recentOrders.length === 0 ? (
          <p className="mt-4 text-muted-foreground">{t("noOrders")}</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium">{t("orderNumber")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("orderer")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("amount")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("status")}</th>
                  <th className="px-4 py-3 text-left font-medium">{t("dateTime")}</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order: any) => (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/orders/${order.id}`} className="text-primary hover:underline">
                        {order.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-4 py-3">{order.user.name}</td>
                    <td className="px-4 py-3">{formatPrice(order.totalAmount, locale)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">
                        {order.status === "PENDING" && t("statusReceived")}
                        {order.status === "CONFIRMED" && t("statusConfirmed")}
                        {order.status === "SHIPPING" && t("statusShipping")}
                        {order.status === "DELIVERED" && t("statusDelivered")}
                        {order.status === "CANCELLED" && t("statusCancelled")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(order.createdAt, locale)}
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
