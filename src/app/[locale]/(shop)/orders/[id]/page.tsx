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
import { Textarea } from "@/components/ui/textarea"
import { FileDown, Upload, Pencil, X, CheckCircle } from "lucide-react"

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

interface PaymentConfigInfo {
  method: string
  accountName: string
  accountInfo: string
  bankName: string
  qrCodeUrl: string
  memo: string
}

interface PaymentConfirmation {
  id: string
  receiptImage: string
  transferDate: string
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
  const [editMode, setEditMode] = useState(false)
  const [editFields, setEditFields] = useState({
    recipientName: "",
    recipientPhone: "",
    shippingAddress: "",
    shippingMemo: "",
    paymentMethod: "",
  })
  const [editSaving, setEditSaving] = useState(false)
  const [enabledMethods, setEnabledMethods] = useState<string[]>([])
  const [invoiceLoading, setInvoiceLoading] = useState(false)

  // Payment confirmation states
  const [paymentConfirmation, setPaymentConfirmation] = useState<PaymentConfirmation | null>(null)
  const [receiptImage, setReceiptImage] = useState("")
  const [transferDate, setTransferDate] = useState("")
  const [senderName, setSenderName] = useState("")
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfigInfo | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const statusLabels: Record<string, string> = {
    ORDER_PLACED: t("statusOrderPlaced"),
    INVOICE_SENT: t("statusInvoiceSent"),
    PAYMENT_CONFIRMED: t("statusPaymentConfirmed"),
    SHIPPED: t("statusShipped"),
    CANCELLED: t("statusCancelled"),
  }

  function startEdit() {
    if (!order) return
    setEditFields({
      recipientName: order.recipientName || "",
      recipientPhone: order.recipientPhone || "",
      shippingAddress: order.shippingAddress || "",
      shippingMemo: order.shippingMemo || "",
      paymentMethod: order.paymentMethod || "BANK_TRANSFER",
    })
    setEditMode(true)
  }

  async function handleEditSave() {
    setEditSaving(true)
    try {
      const res = await fetch(`/api/orders/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFields),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      const updated = await res.json()
      setOrder((prev) => prev ? { ...prev, ...updated } : prev)
      setEditMode(false)
      toast.success(t("editSaved"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("editSaveFail"))
    }
    setEditSaving(false)
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
    if (!receiptImage || !transferDate || !senderName) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/orders/${params.id}/payment-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receiptImage,
          transferDate,
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
      fetch("/api/payment-config").then((res) => res.json()),
    ]).then(([orderData, confirmData, paymentConfigs]) => {
      setOrder(orderData)
      if (confirmData && confirmData.id) {
        setPaymentConfirmation(confirmData)
      }
      if (Array.isArray(paymentConfigs)) {
        setEnabledMethods(paymentConfigs.map((c: PaymentConfigInfo) => c.method))
        if (orderData.paymentMethod) {
          const matched = paymentConfigs.find((c: PaymentConfigInfo) => c.method === orderData.paymentMethod)
          if (matched) setPaymentConfig(matched)
        }
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
    (order.status === "INVOICE_SENT") &&
    (order.paymentMethod === "BANK_TRANSFER" || order.paymentMethod === "ALIPAY" || order.paymentMethod === "WECHAT")

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
          {(order.status === "ORDER_PLACED" || order.status === "INVOICE_SENT") && (
            <>
              {!editMode && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={startEdit}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  {t("editOrder")}
                </Button>
              )}
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
            <span>{
              order.paymentMethod === "BANK_TRANSFER" ? t("bankTransfer")
              : order.paymentMethod === "ALIPAY" ? t("alipay")
              : order.paymentMethod === "WECHAT" ? t("wechat")
              : order.paymentMethod
            }</span>
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
                    <Label>{t("receiptImage")} *</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleReceiptUpload}
                      className="hidden"
                    />
                    {receiptImage ? (
                      <div className="space-y-2">
                        <div className="relative inline-block">
                          <img
                            src={receiptImage}
                            alt="Receipt"
                            className="h-32 w-32 rounded border object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setReceiptImage("")
                              if (fileInputRef.current) fileInputRef.current.value = ""
                            }}
                            className="absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white shadow hover:bg-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600">{t("receiptImageUploaded")}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                          >
                            {t("receiptImageChange")}
                          </Button>
                        </div>
                      </div>
                    ) : (
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
                    )}
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
                    <Label>{t("senderName")}</Label>
                    <Input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={handlePaymentConfirmSubmit}
                    disabled={submitting || !receiptImage || !transferDate || !senderName}
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

      {editMode ? (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>{t("editShippingInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t("receiver")}</Label>
                <Input
                  value={editFields.recipientName}
                  onChange={(e) => setEditFields((prev) => ({ ...prev, recipientName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("contact")}</Label>
                <Input
                  value={editFields.recipientPhone}
                  onChange={(e) => setEditFields((prev) => ({ ...prev, recipientPhone: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("address")}</Label>
              <Input
                value={editFields.shippingAddress}
                onChange={(e) => setEditFields((prev) => ({ ...prev, shippingAddress: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("shippingMemo")}</Label>
              <Textarea
                value={editFields.shippingMemo}
                onChange={(e) => setEditFields((prev) => ({ ...prev, shippingMemo: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("paymentMethod")}</Label>
              <div className="space-y-2">
                {([
                  { value: "BANK_TRANSFER", label: t("bankTransfer") },
                  { value: "ALIPAY", label: t("alipay") },
                  { value: "WECHAT", label: t("wechat") },
                ] as const).filter((m) => enabledMethods.includes(m.value)).map((method) => (
                  <label
                    key={method.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors ${
                      editFields.paymentMethod === method.value
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted"
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={method.value}
                      checked={editFields.paymentMethod === method.value}
                      onChange={(e) => setEditFields((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                    />
                    <span className="font-medium">{method.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleEditSave} disabled={editSaving} className="flex-1">
                {editSaving ? t("editSaving") : t("editSave")}
              </Button>
              <Button variant="outline" onClick={() => setEditMode(false)} className="flex-1">
                {tc("cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : order.recipientName ? (
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
      ) : null}

      {order.paymentStatus === "PENDING" && paymentConfig && (
        <Card className="border-primary">
          <CardContent className="py-4 space-y-3">
            <p className="font-medium">
              {order.paymentMethod === "BANK_TRANSFER" ? t("bankInfo")
                : order.paymentMethod === "ALIPAY" ? t("alipayInfo")
                : t("wechatInfo")}
            </p>
            <p className="text-sm text-muted-foreground">
              {order.paymentMethod === "BANK_TRANSFER" ? t("bankInfoDesc")
                : order.paymentMethod === "ALIPAY" ? t("alipayInfoDesc")
                : t("wechatInfoDesc")}
            </p>
            <div className="space-y-1 text-sm">
              {paymentConfig.bankName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("bankAccountLabel")}</span>
                  <span>{paymentConfig.bankName} {paymentConfig.accountInfo} ({paymentConfig.accountName})</span>
                </div>
              )}
              {!paymentConfig.bankName && paymentConfig.accountInfo && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {order.paymentMethod === "ALIPAY" ? t("alipayAccountLabel") : t("wechatAccountLabel")}
                  </span>
                  <span>{paymentConfig.accountInfo} ({paymentConfig.accountName})</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("depositAmountLabel")}</span>
                <span className="font-medium">{formatPrice(order.totalAmount, locale, rate)}</span>
              </div>
            </div>
            {paymentConfig.qrCodeUrl && (
              <div className="flex justify-center pt-2">
                <img src={paymentConfig.qrCodeUrl} alt="QR Code" className="h-40 w-40 rounded border object-contain" />
              </div>
            )}
            {paymentConfig.memo && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{paymentConfig.memo}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
