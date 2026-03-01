"use client"

import { useEffect, useState } from "react"
import { Link, useRouter } from "@/i18n/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatPrice, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations, useLocale } from "next-intl"
import { useCurrency } from "@/hooks/use-currency"
import { STATUS_COLOR } from "@/lib/order-status"

interface Order {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  createdAt: string
  items: { id: string; productName: string; quantity: number }[]
}

export default function OrdersPage() {
  const router = useRouter()
  const t = useTranslations("order")
  const tc = useTranslations("common")
  const locale = useLocale()
  const { rate } = useCurrency()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

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

  function loadOrders() {
    setLoading(true)
    fetch("/api/orders")
      .then((res) => res.json())
      .then(setOrders)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadOrders() }, [])

  async function handleCancel(orderId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(t("cancelConfirm"))) return
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(t("cancelSuccess"))
      loadOrders()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("cancelFail"))
    }
  }

  async function handleEdit(orderId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(t("editConfirm"))) return
    try {
      const res = await fetch(`/api/orders/${orderId}/reorder`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(t("editSuccess"))
      router.push("/cart")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("editFail"))
    }
  }

  if (loading) {
    return <div className="py-10 text-center text-muted-foreground">{tc("loading")}</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{order.orderNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(order.createdAt, locale)}
                      </p>
                      <p className="mt-1 text-sm">
                        {order.items[0]?.productName}
                        {order.items.length > 1 && t("moreItems", { count: order.items.length - 1 })}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLOR[order.status] || ""}`}>
                        {statusLabels[order.status]}
                      </span>
                      <p className="mt-1 font-bold">{formatPrice(order.totalAmount, locale, rate)}</p>
                      {order.status === "ORDER_PLACED" && (
                        <div className="mt-2 flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleEdit(order.id, e)}
                          >
                            {tc("edit")}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => handleCancel(order.id, e)}
                          >
                            {tc("cancel")}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
