"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useRouter } from "@/i18n/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPrice, formatDateTime } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations, useLocale } from "next-intl"

interface OrderDetail {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  paymentMethod: string | null
  paymentStatus: string
  recipientName: string | null
  recipientPhone: string | null
  shippingAddress: string | null
  shippingMemo: string | null
  createdAt: string
  items: {
    id: string
    productName: string
    colorName: string
    sizeName: string
    quantity: number
    price: number
  }[]
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations("order")
  const tc = useTranslations("common")
  const locale = useLocale()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [editing, setEditing] = useState(false)

  const statusLabels: Record<string, string> = {
    PENDING: t("statusPending"),
    CONFIRMED: t("statusConfirmed"),
    SHIPPING: t("statusShipping"),
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

  useEffect(() => {
    fetch(`/api/orders/${params.id}`)
      .then((res) => res.json())
      .then(setOrder)
      .finally(() => setLoading(false))
  }, [params.id])

  if (loading) {
    return <div className="py-10 text-center text-muted-foreground">{tc("loading")}</div>
  }

  if (!order) {
    return <div className="py-10 text-center text-muted-foreground">{t("notFound")}</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("detailTitle")}</h1>
        <div className="flex items-center gap-2">
          <Badge>{statusLabels[order.status]}</Badge>
          {order.status === "PENDING" && (
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
                  <span className="ml-3 font-medium">{formatPrice(item.price * item.quantity, locale)}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between border-t pt-3 font-bold">
              <span>{t("totalAmount")}</span>
              <span className="text-primary">{formatPrice(order.totalAmount, locale)}</span>
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
              {t("depositAmountLabel")}: {formatPrice(order.totalAmount, locale)}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
