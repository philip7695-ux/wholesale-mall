"use client"

import { useEffect, useState } from "react"
import { Link, useRouter } from "@/i18n/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatPrice, formatDate } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations, useLocale } from "next-intl"
import { formatAmountIn } from "@/lib/currency"
import { canBuyerCancel } from "@/lib/order-status"
import { OrderStatusStepper } from "@/components/order/order-status-stepper"

interface Order {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  currency: string | null
  createdAt: string
  cancelReason: string | null
  cancelledByAdmin: boolean
  items: { id: string; productName: string; quantity: number }[]
}

export default function OrdersPage() {
  const router = useRouter()
  const t = useTranslations("order")
  const tc = useTranslations("common")
  const locale = useLocale()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

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

  // 취소된 주문을 내역에서 영구 삭제(치우기)
  async function handleDelete(orderId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(t("deleteConfirm"))) return
    try {
      const res = await fetch(`/api/orders/${orderId}?permanent=true`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(t("deleteSuccess"))
      loadOrders()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("deleteFail"))
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
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium">
                        {order.orderNumber}
                        {order.status === "CANCELLED" && (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                            {t("statusCancelled")}
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(order.createdAt, locale)}
                      </p>
                      <p className="mt-1 text-sm">
                        {order.items[0]?.productName}
                        {order.items.length > 1 && t("moreItems", { count: order.items.length - 1 })}
                      </p>
                      {/* 판매자가 취소했으면 이유를 바로 보여준다.
                          주문이 말없이 사라진 것처럼 보이면 안 된다. */}
                      {order.status === "CANCELLED" && order.cancelReason && (
                        <p className="mt-1.5 rounded border-l-2 border-destructive bg-destructive/5 px-2 py-1 text-xs text-destructive">
                          <span className="font-medium">
                            {order.cancelledByAdmin ? t("cancelledBySeller") : t("cancelReason")}
                          </span>{" "}
                          {order.cancelReason}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-bold">{formatAmountIn(order.totalAmount, order.currency || "KRW")}</p>
                      {/* 수정은 창고에 넘어가기 전에만, 취소는 확정 전까지 */}
                      {canBuyerCancel(order.status) && (
                        <div className="mt-2 flex justify-end gap-1">
                          {order.status === "ORDER_PLACED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleEdit(order.id, e)}
                            >
                              {tc("edit")}
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => handleCancel(order.id, e)}
                          >
                            {tc("cancel")}
                          </Button>
                        </div>
                      )}
                      {/* 취소된 주문은 내역에서 삭제(치우기)할 수 있다 */}
                      {order.status === "CANCELLED" && (
                        <div className="mt-2 flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleDelete(order.id, e)}
                          >
                            {tc("delete")}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* 전체 진행 흐름을 항상 그려두고 지나온 단계를 컬러로 켠다 */}
                  {order.status !== "CANCELLED" && (
                    <OrderStatusStepper status={order.status} size="sm" className="mt-4" />
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
