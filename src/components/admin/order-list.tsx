"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Download, Trash2 } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { toast } from "sonner"

const statusLabels: Record<string, string> = {
  PENDING: "주문접수",
  CONFIRMED: "주문확인",
  SHIPPING: "배송중",
  DELIVERED: "배송완료",
  CANCELLED: "취소됨",
}

const paymentLabels: Record<string, string> = {
  PENDING: "입금대기",
  PAID: "결제완료",
  FAILED: "실패",
  REFUNDED: "환불",
}

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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState<string | null>(null)

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
      if (!res.ok) throw new Error("다운로드 실패")

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const disposition = res.headers.get("Content-Disposition") || ""
      const match = disposition.match(/filename\*=UTF-8''(.+)/)
      a.download = match ? decodeURIComponent(match[1]) : "주문목록.xlsx"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success("엑셀 파일이 다운로드되었습니다.")
    } catch {
      toast.error("엑셀 다운로드에 실패했습니다.")
    }
    setLoading(null)
  }

  async function handleDelete(orderId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm("정말 이 주문을 영구 삭제하시겠습니까?")) return

    setLoading(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}?permanent=true`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "삭제 실패")
      }
      toast.success("주문이 삭제되었습니다.")
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(orderId)
        return next
      })
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제에 실패했습니다.")
    }
    setLoading(null)
  }

  return (
    <>
      {/* 상단 툴바 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">주문 관리</h1>
          {selected.size > 0 && (
            <Badge variant="secondary">{selected.size}건 선택</Badge>
          )}
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={loading === "export"}
        >
          <Download className="mr-2 h-4 w-4" />
          {loading === "export"
            ? "다운로드중..."
            : selected.size > 0
              ? `선택 ${selected.size}건 엑셀 다운로드`
              : "전체 엑셀 다운로드"}
        </Button>
      </div>

      {/* 전체 선택 */}
      <div className="flex items-center gap-2 px-1">
        <Checkbox
          id="select-all"
          checked={allSelected}
          onCheckedChange={toggleAll}
        />
        <label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
          전체 선택
        </label>
      </div>

      {/* 주문 목록 */}
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
                        {order.items.length}개 상품 | {new Date(order.createdAt).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-bold">{formatPrice(order.totalAmount)}</p>
                      {order.status === "CANCELLED" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => handleDelete(order.id, e)}
                          disabled={loading === order.id}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          {loading === order.id ? "삭제중..." : "삭제"}
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
