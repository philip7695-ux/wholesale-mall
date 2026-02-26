"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [editing, setEditing] = useState(false)

  async function handleEdit() {
    if (!confirm("주문을 장바구니로 되돌려서 수정하시겠습니까?")) return
    setEditing(true)
    try {
      const res = await fetch(`/api/orders/${params.id}/reorder`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("장바구니로 복원되었습니다. 수정 후 다시 주문해주세요.")
      router.push("/cart")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "수정에 실패했습니다.")
    }
    setEditing(false)
  }

  async function handleCancel() {
    if (!confirm("주문을 취소하시겠습니까?")) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/orders/${params.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("주문이 취소되었습니다.")
      router.push("/orders")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "취소에 실패했습니다.")
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
    return <div className="py-10 text-center text-muted-foreground">로딩중...</div>
  }

  if (!order) {
    return <div className="py-10 text-center text-muted-foreground">주문을 찾을 수 없습니다.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">주문 상세</h1>
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
                {editing ? "처리 중..." : "주문 수정"}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancel}
                disabled={cancelling}
              >
                {cancelling ? "취소 중..." : "주문 취소"}
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>주문 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">주문번호</span>
            <span>{order.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">주문일시</span>
            <span>{new Date(order.createdAt).toLocaleString("ko-KR")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">결제방법</span>
            <span>{order.paymentMethod === "BANK_TRANSFER" ? "무통장입금" : order.paymentMethod}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">결제상태</span>
            <span>{order.paymentStatus === "PENDING" ? "입금대기" : order.paymentStatus === "PAID" ? "결제완료" : order.paymentStatus}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>주문 상품</CardTitle>
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
                  <span>{item.quantity}개</span>
                  <span className="ml-3 font-medium">{formatPrice(item.price * item.quantity)}</span>
                </div>
              </div>
            ))}
            <div className="flex justify-between border-t pt-3 font-bold">
              <span>총 금액</span>
              <span className="text-primary">{formatPrice(order.totalAmount)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {order.recipientName && (
        <Card>
          <CardHeader>
            <CardTitle>배송 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">수령인</span>
              <span>{order.recipientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">연락처</span>
              <span>{order.recipientPhone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">주소</span>
              <span>{order.shippingAddress}</span>
            </div>
            {order.shippingMemo && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">배송메모</span>
                <span>{order.shippingMemo}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "PENDING" && (
        <Card className="border-primary">
          <CardContent className="py-4">
            <p className="font-medium">입금 안내</p>
            <p className="mt-1 text-sm text-muted-foreground">
              아래 계좌로 입금해주세요. 확인 후 주문이 진행됩니다.<br />
              입금 계좌: 국민은행 000-000000-00-000 (도매몰)<br />
              입금액: {formatPrice(order.totalAmount)}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
