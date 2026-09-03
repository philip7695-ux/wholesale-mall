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
import { FileDown, Package, Truck, Plus, X } from "lucide-react"
import { cancelOrderWithReason, purgeOrder } from "@/lib/order-cancel.client"
import { isEditable } from "@/lib/order-revision"
import { formatPrice, formatDateTime } from "@/lib/utils"

interface PaymentConfirmationData {
  id: string
  receiptImage: string
  transferDate: string
  senderName: string
  status: "PENDING" | "CONFIRMED" | "REJECTED"
  rejectionReason: string | null
  createdAt: string
}

export function OrderStatusForm({
  orderId,
  currentStatus,
  currentPaymentStatus,
  currentTrackingNumbers,
  currentShippingCarrier,
  invoiceNumber,
  paymentConfirmation,
  currentVatRate = 0,
  defaultInvoicePaymentMethod = "BANK_TRANSFER",
  availablePaymentMethods = ["BANK_TRANSFER", "BANK_TRANSFER_FOREIGN", "ALIPAY", "WECHAT"],
  currentCurrency = "KRW",
  currentInvoiceCurrency = null,
  currentDistributionNumber = null,
  currentReleaseNumber = null,
}: {
  orderId: string
  currentStatus: string
  currentPaymentStatus: string
  currentTrackingNumbers?: string[]
  currentShippingCarrier?: string | null
  invoiceNumber?: string | null
  paymentConfirmation?: PaymentConfirmationData | null
  currentVatRate?: number
  defaultInvoicePaymentMethod?: string
  availablePaymentMethods?: string[]
  currentCurrency?: string
  currentInvoiceCurrency?: string | null
  currentDistributionNumber?: string | null
  currentReleaseNumber?: string | null
}) {
  const router = useRouter()
  const t = useTranslations("admin")
  const locale = useLocale()
  const [paymentStatus, setPaymentStatus] = useState(currentPaymentStatus)
  // 인보이스 발행 조립 패널 상태
  const [composing, setComposing] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [vatEnabled, setVatEnabled] = useState(currentVatRate > 0)
  const [vatPercent, setVatPercent] = useState(
    currentVatRate > 0 ? String(Math.round(currentVatRate * 100)) : "10",
  )
  const [invPayMethod, setInvPayMethod] = useState(defaultInvoicePaymentMethod)
  const [invCurrency, setInvCurrency] = useState(currentInvoiceCurrency || currentCurrency)
  // 사내 배분번호·출고번호. 앞자리 0을 보존해야 하므로 문자열로 다룬다.
  const [distNumber, setDistNumber] = useState(currentDistributionNumber || "")
  const [relNumber, setRelNumber] = useState(currentReleaseNumber || "")

  // 결제수단을 고르면 통화가 자연스럽게 따라간다(알리페이·위챗→CNY 등).
  // 이후 통화 버튼으로 따로 바꿀 수도 있다.
  function chooseMethod(m: string) {
    setInvPayMethod(m)
    if (m === "ALIPAY" || m === "WECHAT") setInvCurrency("CNY")
    else if (m === "BANK_TRANSFER") setInvCurrency("KRW")
    else if (m === "BANK_TRANSFER_FOREIGN") setInvCurrency("USD")
  }
  // 박스가 여럿이면 운송장 번호도 여럿. 빈 칸 하나로 시작해 늘려간다.
  const [trackingNumbers, setTrackingNumbers] = useState<string[]>(
    currentTrackingNumbers && currentTrackingNumbers.length > 0
      ? currentTrackingNumbers
      : [""],
  )
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

  // 조립 옵션을 저장한 뒤 인보이스를 발행한다.
  async function issueInvoice() {
    setIssuing(true)
    try {
      const vatRate = vatEnabled ? (Number(vatPercent) || 0) / 100 : 0
      const res = await fetch(`/api/orders/${orderId}/invoice-options`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vatRate,
          invoicePaymentMethod: invPayMethod,
          invoiceCurrency: invCurrency,
          distributionNumber: distNumber,
          releaseNumber: relNumber,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error)
      }
      // 옵션이 저장된 상태로 실제 발행(PDF 다운로드 + 상태 전이 + 메일)
      await handleInvoice()
      setComposing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invoiceDownloadFail"))
    }
    setIssuing(false)
  }

  const paymentMethodLabels: Record<string, string> = {
    BANK_TRANSFER: t("paymentMethodBankTransfer"),
    BANK_TRANSFER_FOREIGN: t("paymentMethodBankTransferForeign"),
    ALIPAY: t("paymentMethodAlipay"),
    WECHAT: t("paymentMethodWechat"),
  }

  const orderStatuses = [
    { value: "ORDER_PLACED", label: t("orderStatusOrderPlaced") },
    { value: "STOCK_CHECKING", label: t("orderStatusStockChecking") },
    { value: "BUYER_REVIEW", label: t("orderStatusBuyerReview") },
    { value: "CONFIRMED", label: t("orderStatusConfirmed") },
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

  // 취소되지 않은 주문은 먼저 사유와 함께 취소한다. 바이어가 사유를 봐야
  // 주문이 말없이 사라지지 않는다. 이미 취소된 주문만 영구 삭제한다.
  async function handleDelete() {
    const alreadyCancelled = currentStatus === "CANCELLED"
    setLoading(true)
    try {
      if (alreadyCancelled) {
        if (!confirm(t("orderPermanentDeleteConfirm"))) {
          setLoading(false)
          return
        }
        await purgeOrder(orderId)
        toast.success(t("orderDeleted"))
        router.push("/admin/orders")
      } else {
        const done = await cancelOrderWithReason(orderId, {
          ask: t("orderCancelReasonAsk"),
          required: t("orderCancelReasonRequired"),
        })
        if (done) {
          toast.success(t("orderCancelledNotified"))
          router.refresh()
        }
      }
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
    const cleaned = trackingNumbers.map((n) => n.trim()).filter((n) => n !== "")
    if (cleaned.length === 0) {
      toast.error(t("trackingNumberRequired"))
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trackingNumbers: cleaned, shippingCarrier }),
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
  const isPaymentConfirmed = currentStatus === "PAYMENT_CONFIRMED"
  const isShipped = currentStatus === "SHIPPED"
  const isCancelled = currentStatus === "CANCELLED"
  // 확정 전(수량 조정 가능)에는 인보이스·패킹리스트를 낼 수 없다.
  // 수량이 아직 굳지 않았기 때문. 확정 이후에만 문서를 연다.
  const isRevisable = isEditable(currentStatus)
  const docsEnabled = !isRevisable && !isCancelled
  // 결제 상태는 인보이스가 나간 뒤에만 만진다(바이어가 결제할 대상이 생김).
  const canEditPayment = currentStatus === "INVOICE_SENT"

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
          {/* 문서 다운로드 — 확정 후에만 연다 */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => (invoiceNumber ? handleInvoice() : setComposing((v) => !v))}
              disabled={invoiceLoading || !docsEnabled}
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
              disabled={packingLoading || !docsEnabled}
              className="flex-1"
            >
              <Package className="mr-2 h-4 w-4" />
              {packingLoading ? t("packingListGenerating") : t("packingListDownload")}
            </Button>
          </div>
          {isRevisable && (
            <p className="text-xs text-muted-foreground">{t("docsAfterConfirmHint")}</p>
          )}

          {/* 인보이스 조립 패널 — 발행 전, 부가세·결제수단을 골라 넣는다 */}
          {composing && !invoiceNumber && docsEnabled && (
            <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">{t("invoiceComposeTitle")}</p>

              {/* 부가세 모듈 */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={vatEnabled}
                    onChange={(e) => setVatEnabled(e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  {t("invoiceVatInclude")}
                </label>
                {vatEnabled && (
                  <div className="flex items-center gap-2 pl-6">
                    <Label className="text-xs text-muted-foreground">{t("invoiceVatRate")}</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={vatPercent}
                      onChange={(e) => setVatPercent(e.target.value)}
                      className="h-8 w-20"
                    />
                    <span className="text-sm">%</span>
                  </div>
                )}
              </div>

              {/* 결제수단 모듈 */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t("invoicePaymentModule")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {availablePaymentMethods.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => chooseMethod(m)}
                      className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                        invPayMethod === m
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:bg-accent"
                      }`}
                    >
                      {paymentMethodLabels[m] || m}
                    </button>
                  ))}
                </div>
              </div>

              {/* 결제 통화 모듈 — 수출 건이라도 위안화·한화로 받을 수 있다 */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t("invoiceCurrencyModule")}</Label>
                <div className="flex gap-2">
                  {["KRW", "USD", "CNY"].map((cur) => (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => setInvCurrency(cur)}
                      className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                        invCurrency === cur
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:bg-accent"
                      }`}
                    >
                      {cur}
                    </button>
                  ))}
                </div>
              </div>

              {/* 배분번호·출고번호 모듈 — 사내 관리번호라 비워둘 수 있다 */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">{t("invoiceNumbersModule")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    inputMode="numeric"
                    value={distNumber}
                    onChange={(e) => setDistNumber(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder={t("invoiceDistributionNumber")}
                    className="h-9"
                  />
                  <Input
                    inputMode="numeric"
                    value={relNumber}
                    onChange={(e) => setRelNumber(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder={t("invoiceReleaseNumber")}
                    className="h-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t("invoiceNumbersHint")}</p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setComposing(false)}
                  disabled={issuing}
                  className="flex-1"
                >
                  {t("invoiceComposeCancel")}
                </Button>
                <Button onClick={issueInvoice} disabled={issuing || invoiceLoading} className="flex-1">
                  <FileDown className="mr-2 h-4 w-4" />
                  {issuing || invoiceLoading ? t("invoiceGenerating") : t("invoiceIssue")}
                </Button>
              </div>
            </div>
          )}

          {/* 인보이스 발행 단계: 결제 상태 변경 */}
          {canEditPayment && (
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
                {/* 박스마다 한 줄. 여러 개면 + 로 늘린다. */}
                {trackingNumbers.map((num, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={num}
                      onChange={(e) =>
                        setTrackingNumbers((prev) =>
                          prev.map((v, j) => (j === i ? e.target.value : v)),
                        )
                      }
                      placeholder={
                        trackingNumbers.length > 1
                          ? t("trackingNumberBox", { n: i + 1 })
                          : t("trackingNumber")
                      }
                    />
                    {trackingNumbers.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setTrackingNumbers((prev) => prev.filter((_, j) => j !== i))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTrackingNumbers((prev) => [...prev, ""])}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t("trackingNumberAdd")}
                </Button>
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
              {currentTrackingNumbers && currentTrackingNumbers.length > 0 && (
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>
                    {t("trackingShippingCarrier")}: {currentShippingCarrier || "-"}
                  </div>
                  <div>
                    {t("trackingNumber")}
                    {currentTrackingNumbers.length > 1 && ` (${currentTrackingNumbers.length})`}:{" "}
                    {currentTrackingNumbers.join(", ")}
                  </div>
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
