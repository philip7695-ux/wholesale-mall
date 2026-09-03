export const dynamic = 'force-dynamic'

import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getTranslations, getLocale } from "next-intl/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatPrice, formatDateTime } from "@/lib/utils"
import { OrderStatusForm } from "@/components/admin/order-status-form"
import { OrderRevisionTable } from "@/components/order-revision-table"
import { WarehouseSheetButton } from "@/components/admin/warehouse-sheet-button"
import { isEditable } from "@/lib/order-revision"
import { getExchangeRate } from "@/lib/currency.server"
import { ORDER_STATUS_FLOW, STATUS_COLOR, STATUS_DOT_COLOR, STATUS_TEXT_COLOR, STATUS_TIMESTAMP_FIELD } from "@/lib/order-status"
import { OrderStatusStepper } from "@/components/order/order-status-stepper"
import { CheckCircle2 } from "lucide-react"

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
      user: { select: { name: true, email: true, phone: true, businessName: true, tradeType: true } },
      items: {
        include: {
          variant: {
            select: {
              stock: true,
              reserved: true,
              product: { select: { code: true } },
            },
          },
        },
      },
      paymentConfirmations: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  })

  if (!order) notFound()

  // 인보이스 결제수단 모듈: 설정된(계좌/QR 채워진) 수단만 고를 수 있게 한다.
  const payConfigs = await prisma.paymentConfig.findMany({
    select: { method: true, accountInfo: true, qrCodeUrl: true },
  }).catch(() => [] as { method: string; accountInfo: string; qrCodeUrl: string }[])
  const availablePaymentMethods = ["BANK_TRANSFER", "BANK_TRANSFER_FOREIGN", "ALIPAY", "WECHAT"].filter((m) => {
    const c = payConfigs.find((p) => p.method === m)
    if (!c) return false
    return m === "ALIPAY" || m === "WECHAT"
      ? (c.qrCodeUrl?.trim() || c.accountInfo?.trim())
      : c.accountInfo?.trim()
  })
  // 기본값: 수출 회원이고 외화계좌가 있으면 외화, 아니면 원화 계좌.
  const defaultInvoicePaymentMethod =
    order.user?.tradeType === "EXPORT" && availablePaymentMethods.includes("BANK_TRANSFER_FOREIGN")
      ? "BANK_TRANSFER_FOREIGN"
      : availablePaymentMethods[0] || "BANK_TRANSFER"

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

      {/* 바이어 화면과 같은 진행 스텝퍼 */}
      {order.status !== "CANCELLED" && (
        <Card>
          <CardContent className="py-5">
            <OrderStatusStepper status={order.status} size="md" />
          </CardContent>
        </Card>
      )}

      {/* 바이어가 조정안을 확인해 되돌렸으면 알린다. 관리자가 확정 타이밍을 안다. */}
      {order.buyerReviewedAt && isEditable(order.status) && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{t("buyerReviewedBanner")}</span>
          <span className="text-emerald-600">· {formatDateTime(order.buyerReviewedAt, locale)}</span>
        </div>
      )}

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

        {/* 배송 정보 — 참고용, 주문 정보 옆에 둔다 */}
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
      </div>

      {/* 1) 바로 할 일: 주문 상품 조정·확정 (주문 오면 첫 업무) */}
      <Card>
        <CardHeader>
          <CardTitle>{to("orderProducts")}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* 확정 전에는 수량을 고칠 수 있는 표로 보여준다.
              창고 확인 결과를 바로 반영하고 바이어에게 넘기기 위해서다. */}
          {isEditable(order.status) ? (
            <div className="space-y-3">
              {/* 창고 답을 받기 전에 먼저 발주서를 보낸다.
                  수량 조정은 그 답이 온 뒤의 일이므로 표보다 위에 둔다. */}
              <WarehouseSheetButton orderId={order.id} />
              <OrderRevisionTable
              orderId={order.id}
              isAdmin
              // 바이어 차례(확인 요청 보낸 뒤)엔 어드민 편집·버튼을 잠근다.
              // 그래야 확인 요청·확정이 라운드당 한 번만 눌린다.
              canEdit={order.status !== "BUYER_REVIEW"}
              items={order.items.map((item: any) => ({
                id: item.id,
                productCode: item.variant?.product?.code ?? null,
                productName: item.productName,
                colorName: item.colorName,
                sizeName: item.sizeName,
                quantity: item.quantity,
                orderedQuantity: item.orderedQuantity,
                price: item.price,
                stock: item.variant ? item.variant.stock : undefined,
              }))}
                locale={locale}
                rate={rate}
              />
            </div>
          ) : (
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
          )}
        </CardContent>
      </Card>

      {/* 2) 다음 단계: 상태 관리 (인보이스·결제·배송) */}
      <OrderStatusForm
        orderId={order.id}
        currentStatus={order.status}
        currentPaymentStatus={order.paymentStatus}
        currentTrackingNumbers={order.trackingNumbers}
        currentShippingCarrier={order.shippingCarrier}
        invoiceNumber={order.invoiceNumber}
        currentVatRate={order.vatRate}
        defaultInvoicePaymentMethod={defaultInvoicePaymentMethod}
        availablePaymentMethods={availablePaymentMethods}
        currentCurrency={order.currency}
        currentInvoiceCurrency={order.invoiceCurrency}
        currentDistributionNumber={order.distributionNumber}
        currentReleaseNumber={order.releaseNumber}
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

      {/* 진행 이력 (타임스탬프) */}
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

      {/* Tracking Info (legacy 단일 송장) */}
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
    </div>
  )
}
