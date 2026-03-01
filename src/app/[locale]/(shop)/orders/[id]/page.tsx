"use client"

import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import { useRouter } from "@/i18n/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatPrice, formatDateTime } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations, useLocale } from "next-intl"
import { useCurrency } from "@/hooks/use-currency"
import { ORDER_STATUS_FLOW, STATUS_COLOR, STATUS_TIMESTAMP_FIELD } from "@/lib/order-status"
import { FileDown, Upload } from "lucide-react"

interface OrderDetail {
  id: string
  orderNumber: string
  invoiceNumber: string | null
  status: string
  totalAmount: number
  gradeDiscount: number
  paymentMethod: string | null
  paymentStatus: string
  recipientName: string | null
  recipientPhone: string | null
  shippingAddress: string | null
  shippingMemo: string | null
  trackingNumber: string | null
  shippingCarrier: string | null
  createdAt: string
  invoiceSentAt: string | null
  awaitingPaymentAt: string | null
  paymentConfirmedAt: string | null
  preparingAt: string | null
  shippedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  items: {
    id: string
    productName: string
    colorName: string
    sizeName: string
    quantity: number
    price: number
  }[]
}

interface PaymentConfirmation {
  id: string
  receiptImage: string
  transferDate: string
  amount: number
  senderName: string
  status: "PENDING" | "CONFIRMED" | "REJECTED"
  rejectionReason: string | null
  createdAt: string
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations("order")
  const tc = useTranslations("common")
  const locale = useLocale()
  const { rate } = useCurrency()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [editing, setEditing] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)

  // Payment confirmation states
  const [paymentConfirmation, setPaymentConfirmation] = useState<PaymentConfirmation | null>(null)
  const [receiptImage, setReceiptImage] = useState("")
  const [transferDate, setTransferDate] = useState("")
  const [transferAmount, setTransferAmount] = useState("")
  const [senderName, setSenderName] = useState("")
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const statusLabels: Record<string, string> = {
    ORDER_PLACED: t("statusOrderPlaced"),
    INVOICE_SENT: t("statusInvoiceSent"),
    AWAITING_PAYMENT: t("statusAwaitingPayment"),
    PAYMENT_CONFIRMED: t("statusPaymentConfirmed"),
    PREPARING: t("statusPreparing"),
    SHIPPED: t("statusShipped"),
    DELIVERED: t("statusDelivered"),
    CANCELLED: t("statusCancelled"),
  }

  async function handleEdit() {
    if (!confirm(t("editConfirm"))) return
    setEditing(true)
    try {
      const res = await fetch(`/api/orders/${params.id}/reorder`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(t("editSuccessDetail"))
      router.push("/cart")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("editFail"))
    }
    setEditing(false)
  }

  async function handleCancel() {
    if (!confirm(t("cancelConfirm"))) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/orders/${params.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(t("cancelSuccess"))
      router.push("/orders")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("cancelFail"))
    }
    setCancelling(false)
  }

  async function handleInvoiceDownload() {
    setInvoiceLoading(true)
    try {
      const res = await fetch(`/api/orders/${params.id}/invoice`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = res.headers.get("Content-Disposition")?.split("filename=")[1] || `invoice.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t("invoiceDownloadFail"))
    }
    setInvoiceLoading(false)
  }

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "receipt")
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setReceiptImage(data.url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("receiptImageUploadFail"))
    }
    setUploading(false)
  }

  async function handlePaymentConfirmSubmit() {
    if (!receiptImage || !transferDate || !transferAmount || !senderName) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/orders/${params.id}/payment-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptImage,
          transferDate,
          amount: Number(transferAmount),
          senderName,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(t("paymentConfirmSubmitted"))
      setPaymentConfirmation(data)
      // Refresh order to get updated status
      const orderRes = await fetch(`/api/orders/${params.id}`)
      const orderData = await orderRes.json()
      setOrder(orderData)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("paymentConfirmFail"))
    }
    setSubmitting(false)
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/orders/${params.id}`).then((res) => res.json()),
      fetch(`/api/orders/${params.id}/payment-confirmation`).then((res) => res.json()),
    ]).then(([orderData, confirmData]) => {
      setOrder(orderData)
      if (confirmData && confirmData.id) {
        setPaymentConfirmation(confirmData)
      }
    }).finally(() => setLoading(false))
  }, [params.id])

  if (loading) {
    return <div className="py-10 text-center text-muted-foreground">{tc("loading")}</div>
  }

  if (!order) {
    return <div className="py-10 text-center text-muted-foreground">{t("notFound")}</div>
  }

  // 타임라인 데이터
  const timelineSteps: { status: string; label: string; timestamp: string | null }[] = ORDER_STATUS_FLOW.map((s) => {
    const field = STATUS_TIMESTAMP_FIELD[s] as keyof OrderDetail
    const ts = order[field] as string | null
    return { status: s, label: statusLabels[s], timestamp: ts }
  })
  if (order.status === "CANCELLED") {
    timelineSteps.push({
      status: "CANCELLED",
      label: statusLabels["CANCELLED"],
      timestamp: order.cancelledAt,
    })
  }

  const showPaymentConfirmSection =
    (order.status === "INVOICE_SENT" || order.status === "AWAITING_PAYMENT") &&
    order.paymentMethod === "BANK_TRANSFER"

  const canSubmitPaymentConfirm =
    !paymentConfirmation || paymentConfirmation.status === "REJECTED"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("detailTitle")}</h1>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[order.status] || ""}`}>
            {statusLabels[order.status]}
          </span>
          {order.status === "ORDER_PLACED" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                disabled={editing}
              >
                {editing ? tc("processing") : t("editOrder")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? t("cancelling") : t("cancelOrder")}
              </Button>
            </>
          )}
          {order.invoiceNumber && order.status !== "ORDER_PLACED" && order.status !== "CANCELLED" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleInvoiceDownload}
              disabled={invoiceLoading}
            >
              <FileDown className="mr-1 h-4 w-4" />
              {invoiceLoading ? t("invoiceDownloading") : t("downloadInvoice")}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("orderInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("orderNumber")}</span>
            <span>{order.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("orderDate")}</span>
            <span>{formatDateTime(order.createdAt, locale)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("paymentMethod")}</span>
            <span>{order.paymentMethod === "BANK_TRANSFER" ? t("bankTransfer") : order.paymentMethod}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("paymentStatus")}</span>
            <span>{order.paymentStatus === "PENDING" ? t("paymentPending") : order.paymentStatus === "PAID" ? t("paymentComplete") : order.paymentStatus}</span>
          </div>
        </CardContent>
      </Card>

      {/* Status Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>{t("statusTimeline")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {timelineSteps.map((step) => (
              <div key={step.status} className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${step.timestamp ? (STATUS_COLOR[step.status]?.split(" ")[0] || "bg-gray-300") : "bg-gray-200"}`} />
                <span className={`text-sm font-medium ${step.timestamp ? "" : "text-muted-foreground"}`}>
                  {step.label}
                </span>
                {step.timestamp && (
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(step.timestamp, locale)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment Confirmation Section */}
      {showPaymentConfirmSection && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>{t("paymentConfirmTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentConfirmation?.status === "PENDING" ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-yellow-600">{t("paymentConfirmPending")}</p>
                <p className="text-sm text-muted-foreground">{t("paymentConfirmPendingDesc")}</p>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("senderName")}</span>
                    <span>{paymentConfirmation.senderName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("transferAmount")}</span>
                    <span>{formatPrice(paymentConfirmation.amount, locale, rate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("transferDate")}</span>
                    <span>{formatDateTime(paymentConfirmation.transferDate, locale)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("receiptImage")}</span>
                    <a href={paymentConfirmation.receiptImage} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      {t("receiptImageView")}
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {paymentConfirmation?.status === "REJECTED" && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3">
                    <p className="text-sm font-medium text-red-600">{t("paymentConfirmRejected")}</p>
                    {paymentConfirmation.rejectionReason && (
                      <p className="mt-1 text-sm text-red-500">
                        {t("paymentConfirmRejectedReason")}: {paymentConfirmation.rejectionReason}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-muted-foreground">{t("paymentConfirmResubmit")}</p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">{t("paymentConfirmDesc")}</p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>{t("receiptImage")}</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleReceiptUpload}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                      >
                        <Upload className="mr-1 h-4 w-4" />
                        {uploading ? t("receiptImageUploading") : t("receiptImageUpload")}
                      </Button>
                      {receiptImage && (
                        <a href={receiptImage} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
                          {t("receiptImageView")}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>{t("transferDate")}</Label>
                    <Input
                      type="date"
                      value={transferDate}
                      onChange={(e) => setTransferDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("transferAmount")}</Label>
                    <Input
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder={String(order.totalAmount)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("senderName")}</Label>
                    <Input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handlePaymentConfirmSubmit}
                    disabled={submitting || !receiptImage || !transferDate || !transferAmount || !senderName}
                    className="w-full"
                  >
                    {submitting ? t("submittingPaymentConfirm") : t("submitPaymentConfirm")}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tracking Info */}
      {order.trackingNumber && (
        <Card>
          <CardHeader>
            <CardTitle>{t("trackingInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("shippingCarrier")}</span>
              <span>{order.shippingCarrier || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("trackingNumber")}</span>
              <span>{order.trackingNumber}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("orderProducts")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{item.productName}</span>
                  <span className="ml-2 text-muted-foreground">
                    {item.colorName} / {item.sizeName}
                  </span>
                </div>
                <div>
                  <span>{item.quantity}{tc("items")}</span>
                  <span className="ml-3 font-medium">{formatPrice(item.price * item.quantity, locale, rate)}</span>
                </div>
              </div>
            ))}
            {order.gradeDiscount > 0 && (
              <div className="flex justify-between border-t pt-2 text-sm text-muted-foreground">
                <span>{t("gradeDiscountLabel", { rate: Math.round(order.gradeDiscount * 100) })}</span>
                <span>-{formatPrice(
                  Math.round(order.items.reduce((s, i) => s + i.price * i.quantity, 0) * order.gradeDiscount),
                  locale,
                  rate,
                )}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-3 font-bold">
              <span>{t("totalAmount")}</span>
              <span className="text-primary">{formatPrice(order.totalAmount, locale, rate)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {order.recipientName && (
        <Card>
          <CardHeader>
            <CardTitle>{t("shippingInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("receiver")}</span>
              <span>{order.recipientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("contact")}</span>
              <span>{order.recipientPhone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("address")}</span>
              <span>{order.shippingAddress}</span>
            </div>
            {order.shippingMemo && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("shippingMemo")}</span>
                <span>{order.shippingMemo}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "PENDING" && (
        <Card className="border-primary">
          <CardContent className="py-4">
            <p className="font-medium">{t("bankInfo")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("bankInfoDesc")}<br />
              {t("bankAccountLabel")}: 국민은행 000-000000-00-000 (도매몰)<br />
              {t("depositAmountLabel")}: {formatPrice(order.totalAmount, locale, rate)}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
