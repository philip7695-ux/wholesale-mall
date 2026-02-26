"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPrice } from "@/lib/utils"
import { toast } from "sonner"

interface CartItem {
  id: string
  quantity: number
  variant: {
    price: number
    product: { name: string; thumbnail: string | null }
    color: { name: string }
    size: { name: string }
  }
}

export default function NewOrderPage() {
  const router = useRouter()
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch("/api/cart")
      .then((res) => res.json())
      .then((data) => {
        setItems(data)
        if (data.length === 0) {
          toast.error("장바구니가 비어있습니다.")
          router.push("/cart")
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  const totalAmount = items.reduce(
    (sum, item) => sum + item.variant.price * item.quantity,
    0,
  )

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)

    const formData = new FormData(e.currentTarget)

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName: formData.get("recipientName"),
          recipientPhone: formData.get("recipientPhone"),
          shippingAddress: formData.get("shippingAddress"),
          shippingMemo: formData.get("shippingMemo"),
          paymentMethod: "BANK_TRANSFER",
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      const order = await res.json()
      toast.success("주문이 완료되었습니다.")
      router.push(`/orders/${order.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "주문 처리 중 오류가 발생했습니다.")
    }
    setSubmitting(false)
  }

  if (loading) {
    return <div className="py-10 text-center text-muted-foreground">로딩중...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">주문서 작성</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order items summary */}
        <Card>
          <CardHeader>
            <CardTitle>주문 상품</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium">{item.variant.product.name}</span>
                    <span className="ml-2 text-muted-foreground">
                      {item.variant.color.name} / {item.variant.size.name}
                    </span>
                  </div>
                  <div>
                    <span>{item.quantity}개</span>
                    <span className="ml-3 font-medium">
                      {formatPrice(item.variant.price * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between border-t pt-3 font-bold">
                <span>총 금액</span>
                <span className="text-primary">{formatPrice(totalAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping info */}
        <Card>
          <CardHeader>
            <CardTitle>배송 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="recipientName">수령인 *</Label>
                <Input id="recipientName" name="recipientName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipientPhone">연락처 *</Label>
                <Input id="recipientPhone" name="recipientPhone" required placeholder="010-0000-0000" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shippingAddress">배송 주소 *</Label>
              <Input id="shippingAddress" name="shippingAddress" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shippingMemo">배송 메모</Label>
              <Textarea id="shippingMemo" name="shippingMemo" rows={2} placeholder="배송 시 요청사항" />
            </div>
          </CardContent>
        </Card>

        {/* Payment */}
        <Card>
          <CardHeader>
            <CardTitle>결제 방법</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md bg-muted p-4">
              <p className="font-medium">무통장입금</p>
              <p className="mt-1 text-sm text-muted-foreground">
                주문 완료 후 입금 계좌 안내가 표시됩니다.
              </p>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting ? "주문 처리중..." : `${formatPrice(totalAmount)} 주문하기`}
        </Button>
      </form>
    </div>
  )
}
