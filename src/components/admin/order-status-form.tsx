"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { toast } from "sonner"

const orderStatuses = [
  { value: "PENDING", label: "주문접수" },
  { value: "CONFIRMED", label: "주문확인" },
  { value: "SHIPPING", label: "배송중" },
  { value: "DELIVERED", label: "배송완료" },
  { value: "CANCELLED", label: "취소" },
]

const paymentStatuses = [
  { value: "PENDING", label: "입금대기" },
  { value: "PAID", label: "결제완료" },
  { value: "FAILED", label: "실패" },
  { value: "REFUNDED", label: "환불" },
]

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
  const [status, setStatus] = useState(currentStatus)
  const [paymentStatus, setPaymentStatus] = useState(currentPaymentStatus)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (!confirm("정말 이 주문을 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return

    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}?permanent=true`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "삭제 실패")
      }

      toast.success("주문이 삭제되었습니다.")
      router.push("/admin/orders")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제에 실패했습니다.")
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

      toast.success("상태가 변경되었습니다.")
      router.refresh()
    } catch {
      toast.error("상태 변경에 실패했습니다.")
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>상태 관리</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>주문 상태</Label>
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
          <Label>결제 상태</Label>
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
          {loading ? "저장중..." : "상태 변경"}
        </Button>
        {(status === "CANCELLED" || currentStatus === "CANCELLED") && (
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
            className="w-full"
          >
            {loading ? "삭제중..." : "주문 영구 삭제"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
