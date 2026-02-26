export const dynamic = 'force-dynamic'

import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/utils"
import { OrderStatusForm } from "@/components/admin/order-status-form"

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true, businessName: true } },
      items: true,
    },
  })

  if (!order) notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">주문 상세</h1>
        <Badge>{order.orderNumber}</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Order info */}
        <Card>
          <CardHeader>
            <CardTitle>주문 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">주문자</span>
              <span>{order.user.name} ({order.user.email})</span>
            </div>
            {order.user.businessName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">상호</span>
                <span>{order.user.businessName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">주문일시</span>
              <span>{order.createdAt.toLocaleString("ko-KR")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">총 금액</span>
              <span className="font-bold">{formatPrice(order.totalAmount)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Status management */}
        <OrderStatusForm
          orderId={order.id}
          currentStatus={order.status}
          currentPaymentStatus={order.paymentStatus}
        />
      </div>

      {/* Shipping */}
      <Card>
        <CardHeader>
          <CardTitle>배송 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">수령인</span>
            <span>{order.recipientName || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">연락처</span>
            <span>{order.recipientPhone || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">주소</span>
            <span>{order.shippingAddress || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">메모</span>
            <span>{order.shippingMemo || "-"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>주문 상품</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {order.items.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{item.productName}</span>
                  <span className="ml-2 text-muted-foreground">
                    {item.colorName} / {item.sizeName}
                  </span>
                </div>
                <div>
                  <span>{item.quantity}개</span>
                  <span className="ml-3">{formatPrice(item.price)}</span>
                  <span className="ml-3 font-medium">{formatPrice(item.price * item.quantity)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
