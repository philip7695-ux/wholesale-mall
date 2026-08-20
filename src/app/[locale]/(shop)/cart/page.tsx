"use client"

import { useEffect, useState } from "react"
import { Link, useRouter } from "@/i18n/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Trash2, AlertTriangle } from "lucide-react"
import { formatPriceCross } from "@/lib/utils"
import { convertCurrency } from "@/lib/currency"
import { resolveTradeTerms, applyVat } from "@/lib/trade"
import { toast } from "sonner"
import { useCurrency } from "@/hooks/use-currency"
import { useSession } from "next-auth/react"
import { checkMoq, type MoqCheckResult } from "@/lib/moq"

interface ProductColor {
  id: string
  name: string
  hexColor: string | null
  moq: number
}

interface CartItem {
  id: string
  quantity: number
  variant: {
    id: string
    price: number
    colorId: string
    product: {
      id: string
      name: string
      code: string | null
      thumbnail: string | null
      moq: number
      colorMoq: number
      priceCurrency: string
      colors: ProductColor[]
      sizes: { id: string; name: string }[]
      variants: { id: string; colorId: string; sizeId: string; price: number; stock: number }[]
    }
    color: { id: string; name: string; colorCode: string | null; hexColor: string | null }
    size: { name: string }
  }
}

interface GridCell {
  variantId: string
  quantity: number
  price: number
  stock: number
}

interface GridRow {
  colorId: string
  colorName: string
  hexColor: string | null
  cells: Record<string, GridCell>   // sizeId -> 칸
  totalQty: number
  subtotal: number
}

interface GroupedProduct {
  productId: string
  productName: string
  productCode: string | null
  thumbnail: string | null
  items: CartItem[]
  subtotal: number
  totalQty: number
  sizes: { id: string; name: string }[]
  rows: GridRow[]
}

function groupByProduct(items: CartItem[]): GroupedProduct[] {
  const map = new Map<string, GroupedProduct>()
  for (const item of items) {
    const pid = item.variant.product.id
    if (!map.has(pid)) {
      map.set(pid, {
        productId: pid,
        productName: item.variant.product.name,
        productCode: item.variant.product.code,
        thumbnail: item.variant.product.thumbnail,
        items: [],
        subtotal: 0,
        totalQty: 0,
        sizes: [],
        rows: [],
      })
    }
    const group = map.get(pid)!
    group.items.push(item)
    group.subtotal += item.variant.price * item.quantity
    group.totalQty += item.quantity
  }

  // 사이즈를 가로로 펼친 표를 만든다. 담지 않은 사이즈도 칸을 두어
  // 빈 칸에 수를 넣으면 바로 담기게 한다.
  for (const group of map.values()) {
    const product = group.items[0].variant.product
    const qtyOf = new Map(group.items.map((i) => [i.variant.id, i.quantity]))

    group.sizes = product.sizes
    // 담긴 컬러만 줄로 만든다. 전 컬러를 펼치면 표가 불필요하게 길어진다.
    const usedColors = new Set(group.items.map((i) => i.variant.color.id))

    group.rows = product.colors
      .filter((c) => usedColors.has(c.id))
      .map((c) => {
        const cells: Record<string, GridCell> = {}
        let totalQty = 0
        let subtotal = 0
        for (const sz of product.sizes) {
          const v = product.variants.find((x) => x.colorId === c.id && x.sizeId === sz.id)
          if (!v) continue
          const quantity = qtyOf.get(v.id) ?? 0
          cells[sz.id] = { variantId: v.id, quantity, price: v.price, stock: v.stock }
          totalQty += quantity
          subtotal += v.price * quantity
        }
        return {
          colorId: c.id,
          colorName: c.name,
          hexColor: (c as any).hexColor ?? null,
          cells,
          totalQty,
          subtotal,
        }
      })
  }
  return Array.from(map.values())
}

export default function CartPage() {
  const router = useRouter()
  const t = useTranslations("cart")
  const tc = useTranslations("common")
  const tsh = useTranslations("shop")
  const locale = useLocale()
  const { rates } = useCurrency()
  const { data: session } = useSession()
  const buyerGrade = session?.user?.buyerGrade || "BRONZE"
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)

  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    // 서버가 500 등으로 본문 없이 응답하면 res.json() 이 예외를 던진다.
    // 상태를 먼저 확인하고, 파싱 실패도 조용히 처리한다.
    fetch("/api/cart")
      .then(async (res) => {
        if (!res.ok) throw new Error(`cart ${res.status}`)
        return res.json()
      })
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((err) => {
        console.error("[cart] load failed:", err)
        setLoadError(true)
      })
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

  /**
   * 그리드 한 칸의 수량을 반영한다.
   * 담기지 않은 사이즈에 수를 넣으면 새로 담고, 0 으로 지우면 뺀다.
   */
  async function setCellQuantity(variantId: string, quantity: number) {
    const existing = items.find((i) => i.variant.id === variantId)

    if (existing) {
      if (quantity <= 0) await removeItem(existing.id)
      else await updateQuantity(existing.id, quantity)
      return
    }
    if (quantity <= 0) return

    const res = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ variantId, quantity }] }),
    })
    if (!res.ok) {
      toast.error((await res.json().catch(() => ({}))).error || tc("error"))
      return
    }
    // 새로 담은 항목의 id 를 알아야 이후 수정이 되므로 다시 불러온다
    const fresh = await fetch("/api/cart").then((r) => r.json()).catch(() => null)
    if (Array.isArray(fresh)) setItems(fresh)
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
  // 통화·부가세는 회원의 거래 유형이 정한다(언어와 무관)
  const { currency: customerCurrency, vatRate } = resolveTradeTerms(
    { tradeType: session?.user?.tradeType as any, currency: session?.user?.currency },
    locale,
  )
  const fp = (amount: number, fromCurrency: string) => formatPriceCross(amount, fromCurrency, locale, rates)
  // 총액은 고객 통화 기준으로 환산 합산
  const itemsTotal = items.reduce(
    (sum, item) => sum + convertCurrency(item.variant.price * item.quantity, item.variant.product.priceCurrency, customerCurrency, rates),
    0,
  )
  // 도매가는 부가세 별도다. 국내 거래는 여기에 10% 가 더해져 청구된다.
  const { supplyAmount, vatAmount, totalAmount } = applyVat(itemsTotal, vatRate)
  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0)

  // MOQ 검증 (상품 그룹별)
  const moqWarnings: { productName: string; result: MoqCheckResult }[] = []
  for (const group of groups) {
    const firstItem = group.items[0]
    const product = firstItem.variant.product
    if (product.moq <= 0 && product.colorMoq <= 0 && !product.colors.some((c) => c.moq > 0)) continue

    const colorQuantities: Record<string, number> = {}
    for (const item of group.items) {
      const cid = item.variant.colorId ?? item.variant.color.id
      colorQuantities[cid] = (colorQuantities[cid] || 0) + item.quantity
    }

    const result = checkMoq({
      productMoq: product.moq,
      colorMoq: product.colorMoq,
      colors: product.colors.map((c) => ({ colorId: c.id, colorName: c.name, moq: c.moq })),
      quantities: colorQuantities,
      grade: buyerGrade,
    })

    if (!result.valid) {
      moqWarnings.push({ productName: group.productName, result })
    }
  }
  const hasMoqWarnings = moqWarnings.length > 0

  if (loading) {
    return <div className="py-10 text-center text-muted-foreground">{tc("loading")}</div>
  }

  // 빈 장바구니와 불러오기 실패는 다르다. 실패를 "비었음"으로 보여주면
  // 담아둔 상품이 사라진 것처럼 오해하게 된다.
  if (loadError) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-muted-foreground">{tsh("loadError")}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          {tc("retry")}
        </Button>
      </div>
    )
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
                            className="h-16 w-16 rounded object-contain bg-white"
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
                        {group.productCode && (
                          <p className="font-mono text-xs text-muted-foreground">{group.productCode}</p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {t("optionsAndQty", { options: group.items.length, qty: group.totalQty })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold">{fp(group.subtotal, group.items[0].variant.product.priceCurrency)}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeProduct(group.productId)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {/* 사이즈를 가로로 펼친 오더시트.
                        담지 않은 사이즈도 열로 두어 빈 칸에 수를 넣으면 바로 담긴다. */}
                    <div className="mt-3 overflow-x-auto rounded border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">
                              {t("color")}
                            </th>
                            {group.sizes.map((sz) => (
                              <th
                                key={sz.id}
                                className="px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
                              >
                                {sz.name}
                              </th>
                            ))}
                            <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">
                              {t("quantity")}
                            </th>
                            <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">
                              {t("amount")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((row) => (
                            <tr key={row.colorId} className="border-b last:border-0">
                              <td className="whitespace-nowrap px-3 py-1.5">
                                <span className="flex items-center gap-1.5">
                                  {row.hexColor && (
                                    <span
                                      className="inline-block h-3 w-3 shrink-0 rounded-full border"
                                      style={{ backgroundColor: row.hexColor }}
                                    />
                                  )}
                                  {row.colorName}
                                </span>
                              </td>
                              {group.sizes.map((sz) => {
                                const cell = row.cells[sz.id]
                                // 그 컬러에 없는 사이즈는 칸 자체를 비운다
                                if (!cell) {
                                  return (
                                    <td key={sz.id} className="px-2 py-1.5 text-center text-gray-300">
                                      –
                                    </td>
                                  )
                                }
                                const soldOut = cell.stock <= 0
                                return (
                                  <td key={sz.id} className="px-1 py-1.5 text-center">
                                    <Input
                                      type="number"
                                      min={0}
                                      max={cell.stock > 0 ? cell.stock : undefined}
                                      value={cell.quantity || ""}
                                      placeholder={soldOut ? "-" : "0"}
                                      disabled={soldOut}
                                      title={soldOut ? t("soldOut") : t("stockLeft", { count: cell.stock })}
                                      onChange={(e) => {
                                        const v = parseInt(e.target.value) || 0
                                        // 재고를 넘겨 담을 수 없다
                                        setCellQuantity(cell.variantId, Math.min(v, cell.stock))
                                      }}
                                      className="mx-auto h-8 w-14 px-1 text-center text-sm"
                                    />
                                  </td>
                                )
                              })}
                              <td className="px-3 py-1.5 text-right tabular-nums">{row.totalQty}</td>
                              <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                                {fp(row.subtotal, group.items[0].variant.product.priceCurrency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* MOQ 경고 */}
          {hasMoqWarnings && (
            <Card className="border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30">
              <CardContent className="py-3">
                <div className="space-y-1 text-sm">
                  <p className="flex items-center gap-1.5 font-medium text-red-800 dark:text-red-200">
                    <AlertTriangle className="h-4 w-4" />
                    {t("moqWarning")}
                  </p>
                  {moqWarnings.map(({ productName, result }) => (
                    <div key={productName}>
                      {result.productMoqRequired > 0 && result.productQtyTotal < result.productMoqRequired && (
                        <p className="text-red-700 dark:text-red-300">
                          {t("moqProductWarning", { productName, required: result.productMoqRequired, actual: result.productQtyTotal })}
                        </p>
                      )}
                      {result.colorErrors.map((err) => (
                        <p key={err.colorId} className="text-red-700 dark:text-red-300">
                          {t("moqColorWarning", { productName, colorName: err.colorName, required: err.required, actual: err.actual })}
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 주문 요약 */}
          <Card>
            <CardContent className="space-y-3 py-4">
              <div className="flex justify-between text-sm">
                <span>{t("productSummary", { count: groups.length, qty: totalQty })}</span>
                <span>{fp(supplyAmount, customerCurrency)}</span>
              </div>
              {/* 도매가가 부가세 별도이므로 국내 거래는 세액을 따로 보여준다 */}
              {vatRate > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{t("vat", { rate: Math.round(vatRate * 100) })}</span>
                  <span>{fp(vatAmount, customerCurrency)}</span>
                </div>
              )}
              <div className="flex justify-between border-t pt-3 text-lg font-bold">
                <span>{t("totalPayment")}</span>
                <span className="text-primary">{fp(totalAmount, customerCurrency)}</span>
              </div>
              {session?.user?.approvalStatus !== "APPROVED" && (
                <p className="text-sm text-destructive text-center">{t("approvalRequired")}</p>
              )}
              <Button
                className="w-full"
                size="lg"
                onClick={() => router.push("/orders/new")}
                disabled={hasMoqWarnings || session?.user?.approvalStatus !== "APPROVED"}
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
