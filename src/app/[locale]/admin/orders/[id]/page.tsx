export const dynamic = 'force-dynamic'

import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getTranslations, getLocale } from "next-intl/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatPrice, formatDateTime } from "@/lib/utils"
import { OrderStatusForm } from "@/components/admin/order-status-form"

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const t = await getTranslations("admin")
  const tc = await getTranslations("common")
  const to = await getTranslations("order")
  const locale = await getLocale()
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
        <h1 className="text-2xl font-bold">{t("orderDetailTitle")}</h1>
        <Badge>{order.orderNumber}</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Order info */}
        <Card>
          <CardHeader>
            <CardTitle>{to("orderInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("ordererLabel")}</span>
              <span>{order.user.name} ({order.user.email})</span>
            </div>
            {order.user.businessName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("businessLabel")}</span>
                <span>{order.user.businessName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("orderDateLabel")}</span>
              <span>{formatDateTime(order.createdAt, locale)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("totalAmountLabel")}</span>
              <span className="font-bold">{formatPrice(order.totalAmount, locale)}</span>
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
          <CardTitle>{to("shippingInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{to("receiver")}</span>
            <span>{order.recipientName || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{to("contact")}</span>
            <span>{order.recipientPhone || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{to("address")}</span>
            <span>{order.shippingAddress || "-"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{to("shippingMemo")}</span>
            <span>{order.shippingMemo || "-"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>{to("orderProducts")}</CardTitle>
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
                  <span>{item.quantity}{tc("items")}</span>
                  <span className="ml-3">{formatPrice(item.price, locale)}</span>
                  <span className="ml-3 font-medium">{formatPrice(item.price * item.quantity, locale)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
