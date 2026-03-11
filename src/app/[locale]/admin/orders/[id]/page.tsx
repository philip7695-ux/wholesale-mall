export const dynamic = 'force-dynamic'

import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getTranslations, getLocale } from "next-intl/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatPrice, formatDateTime } from "@/lib/utils"
import { OrderStatusForm } from "@/components/admin/order-status-form"
import { getExchangeRate } from "@/lib/currency.server"
import { ORDER_STATUS_FLOW, STATUS_COLOR, STATUS_DOT_COLOR, STATUS_TEXT_COLOR, STATUS_TIMESTAMP_FIELD } from "@/lib/order-status"

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const t = await getTranslations("admin")
  const tc = await getTranslations("common")
  const to = await getTranslations("order")
  const locale = await getLocale()
  const { rate } = await getExchangeRate(locale)
  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true, businessName: true } },
      items: true,
      paymentConfirmations: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!order) notFound()

  const statusLabels: Record<string, string> = {
    ORDER_PLACED: t("orderStatusOrderPlaced"),
    INVOICE_SENT: t("orderStatusInvoiceSent"),
    PAYMENT_CONFIRMED: t("orderStatusPaymentConfirmed"),
    SHIPPED: t("orderStatusShipped"),
    CANCELLED: t("orderStatusCancelled"),
  }

  // 타임라인 데이터 구성
  const timelineSteps: { status: string; label: string; timestamp: Date | null }[] = ORDER_STATUS_FLOW.map((s) => {
    const field = STATUS_TIMESTAMP_FIELD[s] as keyof typeof order
    const ts = order[field] as Date | null
    return { status: s, label: statusLabels[s], timestamp: ts }
  })
  if (order.status === "CANCELLED") {
    timelineSteps.push({
      status: "CANCELLED",
      label: statusLabels["CANCELLED"],
      timestamp: order.cancelledAt,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("orderDetailTitle")}</h1>
        <div className="flex items-center gap-2">
          <Badge>{order.orderNumber}</Badge>
          {order.invoiceNumber && (
            <Badge variant="outline">{order.invoiceNumber}</Badge>
          )}
        </div>
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
              <span>{order.user?.name ?? order.deletedUserName ?? "-"} ({order.user?.email ?? order.deletedUserEmail ?? "-"})</span>
            </div>
            {(order.user?.businessName) && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("businessLabel")}</span>
                <span>{order.user.businessName}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("orderDateLabel")}</span>
              <span>{formatDateTime(order.createdAt, locale)}</span>
            </div>
            {order.gradeDiscount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("gradeLabel")}</span>
                <span>{Math.round(order.gradeDiscount * 100)}% {t("gradeDiscountApplied")}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("totalAmountLabel")}</span>
              <span className="font-bold">{formatPrice(order.totalAmount, locale, rate)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Status management */}
        <OrderStatusForm
          orderId={order.id}
          currentStatus={order.status}
          currentPaymentStatus={order.paymentStatus}
          currentTrackingNumber={order.trackingNumber}
          currentShippingCarrier={order.shippingCarrier}
          invoiceNumber={order.invoiceNumber}
          paymentConfirmation={
            order.paymentConfirmations[0]
              ? {
                  ...order.paymentConfirmations[0],
                  transferDate: order.paymentConfirmations[0].transferDate.toISOString(),
                  createdAt: order.paymentConfirmations[0].createdAt.toISOString(),
                }
              : null
          }
        />
      </div>

      {/* Status Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>{to("statusTimeline")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {timelineSteps.map((step) => (
              <div key={step.status} className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full shrink-0 ${step.timestamp ? (STATUS_DOT_COLOR[step.status] || "bg-gray-300") : "bg-gray-200"}`} />
                <span className={`text-sm font-medium ${step.timestamp ? (STATUS_TEXT_COLOR[step.status] || "") : "text-muted-foreground"}`}>
                  {step.label}
                </span>
                {step.timestamp && (
                  <span className={`text-xs ${STATUS_TEXT_COLOR[step.status] || "text-muted-foreground"}`}>
                    {formatDateTime(step.timestamp, locale)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tracking Info */}
      {order.trackingNumber && (
        <Card>
          <CardHeader>
            <CardTitle>{to("trackingInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{to("shippingCarrier")}</span>
              <span>{order.shippingCarrier || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{to("trackingNumber")}</span>
              <span>{order.trackingNumber}</span>
            </div>
          </CardContent>
        </Card>
      )}

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
                  <span className="ml-3">{formatPrice(item.price, locale, rate)}</span>
                  <span className="ml-3 font-medium">{formatPrice(item.price * item.quantity, locale, rate)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
