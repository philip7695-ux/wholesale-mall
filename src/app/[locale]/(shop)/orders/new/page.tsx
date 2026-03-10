"use client"

import { useEffect, useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatPrice } from "@/lib/utils"
import { toast } from "sonner"
import { useTranslations, useLocale } from "next-intl"
import { useCurrency } from "@/hooks/use-currency"

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
  const t = useTranslations("order")
  const tc = useTranslations("common")
  const locale = useLocale()
  const { rate } = useCurrency()
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState("")
  const [enabledMethods, setEnabledMethods] = useState<string[]>([])

  useEffect(() => {
    Promise.all([
      fetch("/api/cart").then((res) => res.json()),
      fetch("/api/payment-config").then((res) => res.json()),
    ]).then(([cartData, paymentConfigs]) => {
      setItems(cartData)
      if (cartData.length === 0) {
        toast.error(t("cartEmpty"))
        router.push("/cart")
      }
      if (Array.isArray(paymentConfigs) && paymentConfigs.length > 0) {
        const methods = paymentConfigs.map((c: { method: string }) => c.method)
        setEnabledMethods(methods)
        setPaymentMethod(methods[0])
      } else {
        setEnabledMethods(["BANK_TRANSFER"])
        setPaymentMethod("BANK_TRANSFER")
      }
    }).finally(() => setLoading(false))
  }, [router, t])

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
          paymentMethod,
          locale,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      const order = await res.json()
      toast.success(t("orderComplete"))
      router.push(`/orders/${order.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("orderError"))
    }
    setSubmitting(false)
  }

  if (loading) {
    return <div className="py-10 text-center text-muted-foreground">{tc("loading")}</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("newTitle")}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order items summary */}
        <Card>
          <CardHeader>
            <CardTitle>{t("newProducts")}</CardTitle>
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
                    <span>{item.quantity}{tc("items")}</span>
                    <span className="ml-3 font-medium">
                      {formatPrice(item.variant.price * item.quantity, locale, rate)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between border-t pt-3 font-bold">
                <span>{t("totalAmount")}</span>
                <span className="text-primary">{formatPrice(totalAmount, locale, rate)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping info */}
        <Card>
          <CardHeader>
            <CardTitle>{t("newShipping")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="recipientName">{t("receiverRequired")}</Label>
                <Input id="recipientName" name="recipientName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="recipientPhone">{t("contactRequired")}</Label>
                <Input id="recipientPhone" name="recipientPhone" required placeholder="010-0000-0000" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="shippingAddress">{t("addressRequired")}</Label>
              <Input id="shippingAddress" name="shippingAddress" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shippingMemo">{t("memoLabel")}</Label>
              <Textarea id="shippingMemo" name="shippingMemo" rows={2} placeholder={t("memoPlaceholder")} />
            </div>
          </CardContent>
        </Card>

        {/* Payment */}
        <Card>
          <CardHeader>
            <CardTitle>{t("paymentMethodTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {([
                { value: "BANK_TRANSFER", label: t("bankTransfer"), desc: t("bankTransferDesc") },
                { value: "ALIPAY", label: t("alipay"), desc: t("alipayDesc") },
                { value: "WECHAT", label: t("wechat"), desc: t("wechatDesc") },
              ] as const).filter((m) => enabledMethods.includes(m.value)).map((method) => (
                <label
                  key={method.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors ${
                    paymentMethod === method.value
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method.value}
                    checked={paymentMethod === method.value}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-medium">{method.label}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{method.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" size="lg" disabled={submitting}>
          {submitting ? t("orderProcessing") : t("orderButton", { price: formatPrice(totalAmount, locale, rate) })}
        </Button>
      </form>
    </div>
  )
}
