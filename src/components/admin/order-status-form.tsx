"use client"

import { useRouter } from "@/i18n/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { toast } from "sonner"
import { FileDown, Package, Truck } from "lucide-react"
import { formatPrice, formatDateTime } from "@/lib/utils"
import { useCurrency } from "@/hooks/use-currency"

interface PaymentConfirmationData {
  id: string
  receiptImage: string
  transferDate: string
  amount: number
  senderName: string
  status: "PENDING" | "CONFIRMED" | "REJECTED"
  rejectionReason: string | null
  createdAt: string
}

export function OrderStatusForm({
  orderId,
  currentStatus,
  currentPaymentStatus,
  currentTrackingNumber,
  currentShippingCarrier,
  invoiceNumber,
  paymentConfirmation,
}: {
  orderId: string
  currentStatus: string
  currentPaymentStatus: string
  currentTrackingNumber?: string | null
  currentShippingCarrier?: string | null
  invoiceNumber?: string | null
  paymentConfirmation?: PaymentConfirmationData | null
}) {
  const router = useRouter()
  const t = useTranslations("admin")
  const locale = useLocale()
  const { rate } = useCurrency()
  const [paymentStatus, setPaymentStatus] = useState(currentPaymentStatus)
  const [trackingNumber, setTrackingNumber] = useState(currentTrackingNumber || "")
  const [shippingCarrier, setShippingCarrier] = useState(currentShippingCarrier || "")
  const [loading, setLoading] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [packingLoading, setPackingLoading] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [confirmLoading, setConfirmLoading] = useState(false)

  async function handleInvoice() {
    setInvoiceLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/invoice`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = res.headers.get("Content-Disposition")?.split("filename=")[1] || `invoice-${orderId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(t("invoiceDownloaded"))
      router.refresh()
    } catch {
      toast.error(t("invoiceDownloadFail"))
    }
    setInvoiceLoading(false)
  }

  async function handlePackingList() {
    setPackingLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/packing-list`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = res.headers.get("Content-Disposition")?.split("''")[1]
        ? decodeURIComponent(res.headers.get("Content-Disposition")!.split("''")[1])
        : `packing-list-${orderId}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(t("packingListDownloaded"))
    } catch {
      toast.error(t("packingListDownloadFail"))
    }
    setPackingLoading(false)
  }

  const orderStatuses = [
    { value: "ORDER_PLACED", label: t("orderStatusOrderPlaced") },
    { value: "INVOICE_SENT", label: t("orderStatusInvoiceSent") },
    { value: "PAYMENT_CONFIRMED", label: t("orderStatusPaymentConfirmed") },
    { value: "SHIPPED", label: t("orderStatusShipped") },
    { value: "CANCELLED", label: t("orderStatusCancelled") },
  ]

  const paymentStatuses = [
    { value: "PENDING", label: t("paymentStatusPending") },
    { value: "PAID", label: t("paymentStatusPaid") },
    { value: "FAILED", label: t("paymentStatusFailed") },
    { value: "REFUNDED", label: t("paymentStatusRefunded") },
  ]

  async function handleDelete() {
    if (!confirm(t("orderPermanentDeleteConfirm"))) return

    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}?permanent=true`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t("orderDeleteFail"))
      }

      toast.success(t("orderDeleted"))
      router.push("/admin/orders")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("orderDeleteError"))
    }
    setLoading(false)
  }

  // 결제 상태만 저장 (자동 전환은 서버에서 처리)
  async function handlePaymentSave() {
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus }),
      })

      if (!res.ok) throw new Error()

      const data = await res.json()
      if (data.promotedGrade) {
        toast.success(t("gradeAutoPromoted"))
      }

      toast.success(t("orderStatusChanged"))
      router.refresh()
    } catch {
      toast.error(t("orderStatusChangeFail"))
    }
    setLoading(false)
  }

  // 송장번호 저장 (자동 SHIPPED 전환은 서버에서 처리)
  async function handleShippingSave() {
    if (!trackingNumber.trim()) {
      toast.error(t("trackingNumberRequired"))
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumber, shippingCarrier }),
      })

      if (!res.ok) throw new Error()

      toast.success(t("orderStatusChanged"))
      router.refresh()
    } catch {
      toast.error(t("orderStatusChangeFail"))
    }
    setLoading(false)
  }

  // 주문 취소
  async function handleCancel() {
    if (!confirm(t("orderCancelConfirm"))) return
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "DELETE",
      })

      if (!res.ok) throw new Error()

      toast.success(t("orderStatusChanged"))
      router.refresh()
    } catch {
      toast.error(t("orderStatusChangeFail"))
    }
    setLoading(false)
  }

  async function handlePaymentAction(action: "confirm" | "reject") {
    setConfirmLoading(true)
    try {
      const body: Record<string, string> = { action }
      if (action === "reject" && rejectionReason) {
        body.rejectionReason = rejectionReason
      }

      const res = await fetch(`/api/orders/${orderId}/payment-confirmation`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      toast.success(action === "confirm" ? t("paymentConfirmed") : t("paymentRejected"))
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("paymentConfirmFail"))
    }
    setConfirmLoading(false)
  }

  // 현재 단계에 맞는 다음 액션 결정
  const isPrePayment = ["ORDER_PLACED", "INVOICE_SENT"].includes(currentStatus)
  const isPaymentConfirmed = currentStatus === "PAYMENT_CONFIRMED"
  const isShipped = currentStatus === "SHIPPED"
  const isCancelled = currentStatus === "CANCELLED"

  return (
    <div className="space-y-6">
      {/* Payment Confirmation Info */}
      {paymentConfirmation?.status === "PENDING" && (
        <Card className="border-yellow-300">
          <CardHeader>
            <CardTitle>{t("paymentConfirmRequest")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
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
            <div className="flex gap-2">
              <Button
                onClick={() => handlePaymentAction("confirm")}
                disabled={confirmLoading}
                className="flex-1"
              >
                {t("confirmPayment")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => handlePaymentAction("reject")}
                disabled={confirmLoading}
                className="flex-1"
              >
                {t("rejectPayment")}
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("rejectionReason")}</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={t("rejectionReasonPlaceholder")}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("orderStatusMgmt")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 문서 다운로드 */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleInvoice}
              disabled={invoiceLoading}
              className="flex-1"
            >
              <FileDown className="mr-2 h-4 w-4" />
              {invoiceLoading
                ? t("invoiceGenerating")
                : invoiceNumber
                  ? t("invoiceRedownload")
                  : t("invoiceGenerate")}
            </Button>
            <Button
              variant="outline"
              onClick={handlePackingList}
              disabled={packingLoading}
              className="flex-1"
            >
              <Package className="mr-2 h-4 w-4" />
              {packingLoading ? t("packingListGenerating") : t("packingListDownload")}
            </Button>
          </div>

          {/* 결제 전 단계: 결제 상태 변경 */}
          {isPrePayment && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{t("nextStepPayment")}</Badge>
              </div>
              <div className="space-y-2">
                <Label>{t("paymentStatusLabel")}</Label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentStatuses.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handlePaymentSave} disabled={loading} className="w-full">
                {loading ? t("orderSaving") : t("paymentSaveButton")}
              </Button>
            </div>
          )}

          {/* 결제 확인 후: 배송 정보 입력 */}
          {isPaymentConfirmed && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{t("nextStepShipping")}</Badge>
              </div>
              <div className="space-y-2">
                <Label>{t("trackingShippingCarrier")}</Label>
                <Input
                  value={shippingCarrier}
                  onChange={(e) => setShippingCarrier(e.target.value)}
                  placeholder={t("trackingShippingCarrier")}
                />
                <Label>{t("trackingNumber")}</Label>
                <Input
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder={t("trackingNumber")}
                />
              </div>
              <Button onClick={handleShippingSave} disabled={loading} className="w-full">
                <Truck className="mr-2 h-4 w-4" />
                {loading ? t("orderSaving") : t("shipOrder")}
              </Button>
            </div>
          )}

          {/* 배송 완료 (SHIPPED = 최종 상태) */}
          {isShipped && (
            <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4">
              {currentTrackingNumber && (
                <div className="text-sm text-muted-foreground">
                  {t("trackingShippingCarrier")}: {currentShippingCarrier || "-"} / {t("trackingNumber")}: {currentTrackingNumber}
                </div>
              )}
            </div>
          )}

          {/* 주문 취소 / 삭제 */}
          {!isCancelled && !isShipped && (
            <Button
              variant="ghost"
              onClick={handleCancel}
              disabled={loading}
              className="w-full text-destructive hover:text-destructive"
            >
              {t("orderStatusCancelled")}
            </Button>
          )}
          {isCancelled && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
              className="w-full"
            >
              {loading ? t("orderDeleting") : t("orderPermanentDelete")}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
