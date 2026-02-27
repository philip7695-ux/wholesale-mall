"use client"

import { useEffect, useState } from "react"
import { Link, useRouter } from "@/i18n/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPrice, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations, useLocale } from "next-intl"

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  CONFIRMED: "secondary",
  SHIPPING: "default",
  DELIVERED: "default",
  CANCELLED: "destructive",
}

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
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const statusLabels: Record<string, string> = {
    PENDING: t("statusPending"),
    CONFIRMED: t("statusConfirmed"),
    SHIPPING: t("statusShipping"),
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
                      <Badge variant={statusVariant[order.status]}>
                        {statusLabels[order.status]}
                      </Badge>
                      <p className="mt-1 font-bold">{formatPrice(order.totalAmount, locale)}</p>
                      {order.status === "PENDING" && (
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
