export const dynamic = 'force-dynamic'

import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/utils"
import Link from "next/link"
import { OrderExportButton } from "@/components/admin/order-export-button"

const statusLabels: Record<string, string> = {
  PENDING: "주문접수",
  CONFIRMED: "주문확인",
  SHIPPING: "배송중",
  DELIVERED: "배송완료",
  CANCELLED: "취소됨",
}

const paymentLabels: Record<string, string> = {
  PENDING: "입금대기",
  PAID: "결제완료",
  FAILED: "실패",
  REFUNDED: "환불",
}

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    include: {
      user: { select: { name: true, email: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">주문 관리</h1>
        {orders.length > 0 && <OrderExportButton />}
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            주문이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order: any) => (
            <Link key={order.id} href={`/admin/orders/${order.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{order.orderNumber}</span>
                        <Badge variant="outline">{statusLabels[order.status]}</Badge>
                        <Badge variant="secondary">{paymentLabels[order.paymentStatus]}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {order.user.name} ({order.user.email})
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {order.items.length}개 상품 | {new Date(order.createdAt).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{formatPrice(order.totalAmount)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
