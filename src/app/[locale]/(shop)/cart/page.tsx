"use client"

import { useEffect, useState } from "react"
import { Link, useRouter } from "@/i18n/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Trash2, Pencil } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { toast } from "sonner"

interface CartItem {
  id: string
  quantity: number
  variant: {
    id: string
    price: number
    product: { id: string; name: string; thumbnail: string | null }
    color: { name: string; colorCode: string | null }
    size: { name: string }
  }
}

interface GroupedProduct {
  productId: string
  productName: string
  thumbnail: string | null
  items: CartItem[]
  subtotal: number
  totalQty: number
}

interface ColorGroup {
  colorName: string
  colorCode: string | null
  items: CartItem[]
  subtotal: number
  totalQty: number
}

function groupItemsByColor(items: CartItem[]): ColorGroup[] {
  const map = new Map<string, ColorGroup>()
  for (const item of items) {
    const cname = item.variant.color.name
    if (!map.has(cname)) {
      map.set(cname, {
        colorName: cname,
        colorCode: item.variant.color.colorCode,
        items: [],
        subtotal: 0,
        totalQty: 0,
      })
    }
    const g = map.get(cname)!
    g.items.push(item)
    g.subtotal += item.variant.price * item.quantity
    g.totalQty += item.quantity
  }
  return Array.from(map.values())
}

function groupByProduct(items: CartItem[]): GroupedProduct[] {
  const map = new Map<string, GroupedProduct>()
  for (const item of items) {
    const pid = item.variant.product.id
    if (!map.has(pid)) {
      map.set(pid, {
        productId: pid,
        productName: item.variant.product.name,
        thumbnail: item.variant.product.thumbnail,
        items: [],
        subtotal: 0,
        totalQty: 0,
      })
    }
    const group = map.get(pid)!
    group.items.push(item)
    group.subtotal += item.variant.price * item.quantity
    group.totalQty += item.quantity
  }
  return Array.from(map.values())
}

export default function CartPage() {
  const router = useRouter()
  const t = useTranslations("cart")
  const tc = useTranslations("common")
  const locale = useLocale()
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingGroup, setEditingGroup] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/cart")
      .then((res) => res.json())
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  async function updateQuantity(cartItemId: string, quantity: number) {
    if (quantity <= 0) {
      await removeItem(cartItemId)
      return
    }
    await fetch("/api/cart", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartItemId, quantity }),
    })
    setItems((prev) =>
      prev.map((item) =>
        item.id === cartItemId ? { ...item, quantity } : item,
      ),
    )
  }

  async function removeItem(cartItemId: string) {
    await fetch("/api/cart", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cartItemId }),
    })
    setItems((prev) => prev.filter((item) => item.id !== cartItemId))
    toast.success(t("deleted"))
  }

  async function removeProduct(productId: string) {
    const productItems = items.filter((i) => i.variant.product.id === productId)
    await Promise.all(
      productItems.map((item) =>
        fetch("/api/cart", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartItemId: item.id }),
        }),
      ),
    )
    setItems((prev) => prev.filter((i) => i.variant.product.id !== productId))
    toast.success(t("productDeleted"))
  }

  const groups = groupByProduct(items)
  const totalAmount = items.reduce(
    (sum, item) => sum + item.variant.price * item.quantity,
    0,
  )
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0)

  if (loading) {
    return <div className="py-10 text-center text-muted-foreground">{tc("loading")}</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">{t("empty")}</p>
            <Link href="/products" className="mt-4 inline-block">
              <Button variant="outline">{t("goShopping")}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {groups.map((group) => {
              const isEditing = editingGroup === group.productId
              return (
                <Card key={group.productId}>
                  <CardContent className="py-4">
                    {/* 상품 헤더 */}
                    <div className="flex items-center gap-4">
                      {group.thumbnail && (
                        <Link href={`/products/${group.productId}`}>
                          <img
                            src={group.thumbnail}
                            alt=""
                            className="h-16 w-16 rounded object-cover"
                          />
                        </Link>
                      )}
                      <div className="flex-1">
                        <Link
                          href={`/products/${group.productId}`}
                          className="font-medium hover:underline"
                        >
                          {group.productName}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {t("optionsAndQty", { options: group.items.length, qty: group.totalQty })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold">{formatPrice(group.subtotal, locale)}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setEditingGroup(isEditing ? null : group.productId)
                          }
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          {isEditing ? tc("done") : tc("edit")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeProduct(group.productId)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* 컬러별 옵션 테이블 */}
                    <div className="mt-3 space-y-2">
                      {groupItemsByColor(group.items).map((colorGroup) => (
                        <div key={colorGroup.colorName} className="overflow-x-auto rounded border">
                          {/* 컬러 헤더 */}
                          <div className="flex items-center gap-2 border-b bg-gray-50 px-3 py-2">
                            {colorGroup.colorCode && (
                              <span
                                className="inline-block h-3.5 w-3.5 rounded-full border"
                                style={{ backgroundColor: colorGroup.colorCode }}
                              />
                            )}
                            <span className="text-sm font-medium">{colorGroup.colorName}</span>
                            <span className="text-xs text-muted-foreground">
                              {t("subtotalUnit", { qty: colorGroup.totalQty, price: formatPrice(colorGroup.subtotal, locale) })}
                            </span>
                          </div>
                          {/* 사이즈 행 */}
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-gray-50/50">
                                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">{t("size")}</th>
                                <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">{t("unitPrice")}</th>
                                <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">{t("quantity")}</th>
                                <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">{t("amount")}</th>
                                {isEditing && <th className="w-8"></th>}
                              </tr>
                            </thead>
                            <tbody>
                              {colorGroup.items.map((item) => (
                                <tr key={item.id} className="border-b last:border-0">
                                  <td className="px-3 py-1.5">{item.variant.size.name}</td>
                                  <td className="px-3 py-1.5 text-right">{formatPrice(item.variant.price, locale)}</td>
                                  <td className="px-3 py-1.5 text-right">
                                    {isEditing ? (
                                      <Input
                                        type="number"
                                        min={1}
                                        value={item.quantity}
                                        onChange={(e) =>
                                          updateQuantity(item.id, parseInt(e.target.value) || 0)
                                        }
                                        className="ml-auto h-7 w-16 text-center text-sm"
                                      />
                                    ) : (
                                      item.quantity
                                    )}
                                  </td>
                                  <td className="px-3 py-1.5 text-right font-medium">
                                    {formatPrice(item.variant.price * item.quantity, locale)}
                                  </td>
                                  {isEditing && (
                                    <td className="px-1 py-1.5 text-center">
                                      <button onClick={() => removeItem(item.id)}>
                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* 주문 요약 */}
          <Card>
            <CardContent className="space-y-3 py-4">
              <div className="flex justify-between text-sm">
                <span>{t("productSummary", { count: groups.length, qty: totalQty })}</span>
                <span>{formatPrice(totalAmount, locale)}</span>
              </div>
              <div className="flex justify-between border-t pt-3 text-lg font-bold">
                <span>{t("totalPayment")}</span>
                <span className="text-primary">{formatPrice(totalAmount, locale)}</span>
              </div>
              <Button
                className="w-full"
                size="lg"
                onClick={() => router.push("/orders/new")}
              >
                {t("order")}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
