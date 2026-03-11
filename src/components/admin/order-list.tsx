"use client"

import { useState } from "react"
import { Link, useRouter } from "@/i18n/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Download, Trash2 } from "lucide-react"
import { formatPrice, formatDateTime } from "@/lib/utils"
import { toast } from "sonner"
import { useCurrency } from "@/hooks/use-currency"
import { STATUS_COLOR } from "@/lib/order-status"

interface OrderItem {
  id: string
  productName: string
  colorName: string
  sizeName: string
  quantity: number
  price: number
}

interface Order {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  totalAmount: number
  createdAt: string
  user: { name: string; email: string } | null
  deletedUserName?: string | null
  deletedUserEmail?: string | null
  items: OrderItem[]
  hasPaymentRequest?: boolean
}

export function OrderList({ orders }: { orders: Order[] }) {
  const router = useRouter()
  const t = useTranslations("admin")
  const tc = useTranslations("common")
  const locale = useLocale()
  const { rate } = useCurrency()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<string | null>(null)

  const statusLabels: Record<string, string> = {
    ORDER_PLACED: t("orderStatusOrderPlaced"),
    INVOICE_SENT: t("orderStatusInvoiceSent"),
    PAYMENT_CONFIRMED: t("orderStatusPaymentConfirmed"),
    SHIPPED: t("orderStatusShipped"),
    CANCELLED: t("orderStatusCancelled"),
  }

  const paymentLabels: Record<string, string> = {
    PENDING: t("paymentStatusPending"),
    PAID: t("paymentStatusPaid"),
    FAILED: t("paymentStatusFailed"),
    REFUNDED: t("paymentStatusRefunded"),
  }

  const allSelected = orders.length > 0 && selected.size === orders.length

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(orders.map((o) => o.id)))
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleExport() {
    setLoading("export")
    try {
      const params = selected.size > 0
        ? `?ids=${Array.from(selected).join(",")}`
        : ""
      const res = await fetch(`/api/orders/export${params}`)
      if (!res.ok) throw new Error(t("orderExportFail"))

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const disposition = res.headers.get("Content-Disposition") || ""
      const match = disposition.match(/filename\*=UTF-8''(.+)/)
      a.download = match ? decodeURIComponent(match[1]) : t("orderExportFilename")
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(t("orderExportSuccess"))
    } catch {
      toast.error(t("orderExportError"))
    }
    setLoading(null)
  }

  async function handleBulkDelete() {
    if (!confirm(t("orderBulkDeleteConfirm", { count: selected.size }))) return

    setLoading("bulk-delete")
    try {
      const results = await Promise.all(
        Array.from(selected).map((id) =>
          fetch(`/api/orders/${id}?permanent=true`, { method: "DELETE" })
        )
      )
      const failed = results.filter((r) => !r.ok).length
      if (failed > 0) {
        toast.error(t("orderBulkDeletePartial", { failed }))
      } else {
        toast.success(t("orderBulkDeleteSuccess", { count: selected.size }))
      }
      setSelected(new Set())
      window.location.reload()
    } catch {
      toast.error(t("orderDeleteError"))
    }
    setLoading(null)
  }

  async function handleDelete(orderId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm(t("orderDeleteConfirm"))) return

    setLoading(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}?permanent=true`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t("orderDeleteFail"))
      }
      toast.success(t("orderDeleted"))
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("orderDeleteError"))
    }
    setLoading(null)
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{t("orderMgmt")}</h1>
          {selected.size > 0 && (
            <Badge variant="secondary">{t("orderSelectedCount", { count: selected.size })}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={loading === "bulk-delete"}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {loading === "bulk-delete" ? t("orderDeleting") : t("orderDeleteSelected", { count: selected.size })}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={loading === "export"}
          >
            <Download className="mr-2 h-4 w-4" />
            {loading === "export"
              ? t("orderDownloading")
              : selected.size > 0
                ? t("orderExportSelected", { count: selected.size })
                : t("orderExportAll")}
          </Button>
        </div>
      </div>

      {/* Select All */}
      <div className="flex items-center gap-2 px-1">
        <Checkbox
          id="select-all"
          checked={allSelected}
          onCheckedChange={toggleAll}
        />
        <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
          {t("selectAll")}
        </label>
      </div>

      {/* Order List */}
      <div className="space-y-3">
        {orders.map((order) => (
          <div key={order.id} className="flex items-start gap-3">
            <div className="pt-5">
              <Checkbox
                checked={selected.has(order.id)}
                onCheckedChange={() => toggleOne(order.id)}
              />
            </div>
            <Link href={`/admin/orders/${order.id}`} className="flex-1 min-w-0">
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{order.orderNumber}</span>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[order.status] || ""}`}>{statusLabels[order.status]}</span>
                        <Badge variant="secondary">{paymentLabels[order.paymentStatus]}</Badge>
                        {order.hasPaymentRequest && (
                          <Badge variant="default" className="bg-yellow-500 text-white">{t("pendingPaymentBadge")}</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {order.user?.name ?? order.deletedUserName ?? "-"} ({order.user?.email ?? order.deletedUserEmail ?? "-"})
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("orderItemCount", { count: order.items.length })} | {formatDateTime(order.createdAt, locale)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-bold">{formatPrice(order.totalAmount, locale, rate)}</p>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={(e) => handleDelete(order.id, e)}
                        disabled={loading === order.id}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        {loading === order.id ? t("orderDeleting") : tc("delete")}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        ))}
      </div>
    </>
  )
}
