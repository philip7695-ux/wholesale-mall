"use client"

import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { toast } from "sonner"

export function OrderStatusForm({
  orderId,
  currentStatus,
  currentPaymentStatus,
}: {
  orderId: string
  currentStatus: string
  currentPaymentStatus: string
}) {
  const router = useRouter()
  const t = useTranslations("admin")
  const [status, setStatus] = useState(currentStatus)
  const [paymentStatus, setPaymentStatus] = useState(currentPaymentStatus)
  const [loading, setLoading] = useState(false)

  const orderStatuses = [
    { value: "PENDING", label: t("orderStatusPending") },
    { value: "CONFIRMED", label: t("orderStatusConfirmed") },
    { value: "SHIPPING", label: t("orderStatusShipping") },
    { value: "DELIVERED", label: t("orderStatusDelivered") },
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

  async function handleSave() {
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, paymentStatus }),
      })

      if (!res.ok) throw new Error()

      toast.success(t("orderStatusChanged"))
      router.refresh()
    } catch {
      toast.error(t("orderStatusChangeFail"))
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("orderStatusMgmt")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t("orderStatusLabel")}</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {orderStatuses.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        <Button onClick={handleSave} disabled={loading} className="w-full">
          {loading ? t("orderSaving") : t("orderChangeStatus")}
        </Button>
        {(status === "CANCELLED" || currentStatus === "CANCELLED") && (
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
  )
}
