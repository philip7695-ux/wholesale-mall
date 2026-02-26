export const dynamic = 'force-dynamic'

import { prisma } from "@/lib/prisma"
import Link from "next/link"

export default async function AdminDashboard() {
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
    { label: "등록 상품", value: productCount, href: "/admin/products" },
    { label: "총 주문", value: orderCount, href: "/admin/orders" },
    { label: "가입 회원", value: memberCount, href: "/admin/members" },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold">대시보드</h1>

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
        <h2 className="text-lg font-semibold">최근 주문</h2>
        {recentOrders.length === 0 ? (
          <p className="mt-4 text-muted-foreground">아직 주문이 없습니다.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium">주문번호</th>
                  <th className="px-4 py-3 text-left font-medium">주문자</th>
                  <th className="px-4 py-3 text-left font-medium">금액</th>
                  <th className="px-4 py-3 text-left font-medium">상태</th>
                  <th className="px-4 py-3 text-left font-medium">일시</th>
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
                    <td className="px-4 py-3">{order.totalAmount.toLocaleString()}원</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">
                        {order.status === "PENDING" && "접수"}
                        {order.status === "CONFIRMED" && "확인"}
                        {order.status === "SHIPPING" && "배송중"}
                        {order.status === "DELIVERED" && "완료"}
                        {order.status === "CANCELLED" && "취소"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("ko-KR")}
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
