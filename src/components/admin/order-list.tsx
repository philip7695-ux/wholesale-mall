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
  user: { name: string; email: string }
  items: OrderItem[]
}

export function OrderList({ orders }: { orders: Order[] }) {
  const router = useRouter()
  const t = useTranslations("admin")
  const tc = useTranslations("common")
  const locale = useLocale()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<string | null>(null)

  const statusLabels: Record<string, string> = {
    PENDING: t("orderStatusPending"),
    CONFIRMED: t("orderStatusConfirmed"),
    SHIPPING: t("orderStatusShipping"),
    DELIVERED: t("orderStatusDelivered"),
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
      router.refresh()
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
                        <Badge variant="outline">{statusLabels[order.status]}</Badge>
                        <Badge variant="secondary">{paymentLabels[order.paymentStatus]}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {order.user.name} ({order.user.email})
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("orderItemCount", { count: order.items.length })} | {formatDateTime(order.createdAt, locale)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-bold">{formatPrice(order.totalAmount, locale)}</p>
                      {order.status === "CANCELLED" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => handleDelete(order.id, e)}
                          disabled={loading === order.id}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          {loading === order.id ? t("orderDeleting") : tc("delete")}
                        </Button>
                      )}
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
