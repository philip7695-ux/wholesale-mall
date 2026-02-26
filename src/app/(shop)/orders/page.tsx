"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatPrice } from "@/lib/utils"
import { toast } from "sonner"

const statusLabels: Record<string, string> = {
  PENDING: "주문접수",
  CONFIRMED: "주문확인",
  SHIPPING: "배송중",
  DELIVERED: "배송완료",
  CANCELLED: "취소됨",
}

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
    if (!confirm("주문을 취소하시겠습니까?")) return
    try {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("주문이 취소되었습니다.")
      loadOrders()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "취소에 실패했습니다.")
    }
  }

  async function handleEdit(orderId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm("주문을 장바구니로 되돌려서 수정하시겠습니까?")) return
    try {
      const res = await fetch(`/api/orders/${orderId}/reorder`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("장바구니로 복원되었습니다.")
      router.push("/cart")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "수정에 실패했습니다.")
    }
  }

  if (loading) {
    return <div className="py-10 text-center text-muted-foreground">로딩중...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">주문 내역</h1>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            주문 내역이 없습니다.
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
                        {new Date(order.createdAt).toLocaleDateString("ko-KR")}
                      </p>
                      <p className="mt-1 text-sm">
                        {order.items[0]?.productName}
                        {order.items.length > 1 && ` 외 ${order.items.length - 1}건`}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant={statusVariant[order.status]}>
                        {statusLabels[order.status]}
                      </Badge>
                      <p className="mt-1 font-bold">{formatPrice(order.totalAmount)}</p>
                      {order.status === "PENDING" && (
                        <div className="mt-2 flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleEdit(order.id, e)}
                          >
                            수정
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={(e) => handleCancel(order.id, e)}
                          >
                            취소
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
