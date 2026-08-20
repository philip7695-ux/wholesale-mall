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
import { sortSizeNames } from "@/lib/product-sizes"

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

/** 표의 한 줄. 스타일 하나의 컬러 하나. */
interface GridRow {
  key: string
  productId: string
  productName: string
  productCode: string | null
  thumbnail: string | null
  priceCurrency: string
  /** 이 스타일의 첫 줄인가. 스타일 이름은 첫 줄에만 적어 표를 읽기 쉽게 한다. */
  firstOfProduct: boolean
  /** 이 스타일이 차지하는 줄 수. 첫 줄의 rowSpan 에 쓴다. */
  productRowSpan: number
  colorId: string
  colorName: string
  hexColor: string | null
  cells: Record<string, GridCell>   // 사이즈 이름 -> 칸
  totalQty: number
  subtotal: number
  /** 이 줄의 단가. 사이즈마다 값이 다르면 최소~최대로 적는다. */
  unitPriceMin: number
  unitPriceMax: number
}

interface CartGrid {
  /** 장바구니 전체 사이즈의 합집합. 표의 열이 된다. */
  sizeNames: string[]
  rows: GridRow[]
  /** 사이즈별 세로 합계 */
  columnTotals: Record<string, number>
}

/** MOQ 검증에 쓰는 스타일 단위 묶음 */
interface ProductGroup {
  productId: string
  productName: string
  items: CartItem[]
  totalQty: number
}

function groupByProduct(items: CartItem[]): ProductGroup[] {
  const map = new Map<string, ProductGroup>()
  for (const item of items) {
    const pid = item.variant.product.id
    if (!map.has(pid)) {
      map.set(pid, {
        productId: pid,
        productName: item.variant.product.name,
        items: [],
        totalQty: 0,
      })
    }
    const g = map.get(pid)!
    g.items.push(item)
    g.totalQty += item.quantity
  }
  return Array.from(map.values())
}

/**
 * 장바구니 전체를 표 하나로 편다.
 *
 * 열은 담긴 상품들의 사이즈를 모두 합친 것이다. 스타일마다 사이즈 레인지가
 * 달라서, 그 스타일에 없는 사이즈 칸은 막아 수량을 넣을 수 없게 한다.
 * 줄은 스타일 × 컬러다. 한 스타일에 컬러가 여럿이면 이름은 첫 줄에만 적는다.
 */
function buildGrid(groups: ProductGroup[]): CartGrid {
  const sizeNames = sortSizeNames([
    ...new Set(
      groups.flatMap((g) => g.items[0].variant.product.sizes.map((s) => s.name)),
    ),
  ])

  const rows: GridRow[] = []
  for (const group of groups) {
    const product = group.items[0].variant.product
    const qtyOf = new Map(group.items.map((i) => [i.variant.id, i.quantity]))
    const sizeIdToName = new Map(product.sizes.map((s) => [s.id, s.name]))
    // 담긴 컬러만 줄로 만든다. 전 컬러를 펼치면 표가 불필요하게 길어진다.
    const usedColors = new Set(group.items.map((i) => i.variant.color.id))
    const colors = product.colors.filter((c) => usedColors.has(c.id))

    colors.forEach((c, idx) => {
      const cells: Record<string, GridCell> = {}
      let totalQty = 0
      let subtotal = 0
      const prices: number[] = []
      for (const v of product.variants) {
        if (v.colorId !== c.id) continue
        const name = sizeIdToName.get(v.sizeId)
        if (!name) continue
        const quantity = qtyOf.get(v.id) ?? 0
        cells[name] = { variantId: v.id, quantity, price: v.price, stock: v.stock }
        totalQty += quantity
        subtotal += v.price * quantity
        prices.push(v.price)
      }
      rows.push({
        unitPriceMin: prices.length ? Math.min(...prices) : 0,
        unitPriceMax: prices.length ? Math.max(...prices) : 0,
        key: `${product.id}:${c.id}`,
        productId: product.id,
        productName: product.name,
        productCode: product.code,
        thumbnail: product.thumbnail,
        priceCurrency: product.priceCurrency,
        firstOfProduct: idx === 0,
        productRowSpan: colors.length,
        colorId: c.id,
        colorName: c.name,
        hexColor: (c as any).hexColor ?? null,
        cells,
        totalQty,
        subtotal,
      })
    })
  }

  const columnTotals: Record<string, number> = {}
  for (const name of sizeNames) {
    columnTotals[name] = rows.reduce((s, r) => s + (r.cells[name]?.quantity ?? 0), 0)
  }

  return { sizeNames, rows, columnTotals }
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
  const grid = buildGrid(groups)
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
          {/* 장바구니 전체를 표 하나로 편다.
              열은 담긴 상품들의 사이즈 합집합이고, 줄은 스타일 × 컬러다.
              그 스타일에 없는 사이즈 칸은 막아 수량을 넣을 수 없게 한다.
              스타일·컬러 열은 가로로 밀어도 따라오도록 왼쪽에 고정한다. */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                {/* 쓰던 오더시트처럼 사이즈 열을 하나로 묶어 이름표를 단다 */}
                <tr className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                  <th rowSpan={2} className="sticky left-0 z-20 w-14 bg-muted/50 px-2 py-2">
                    {t("image")}
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky left-14 z-20 min-w-[120px] bg-muted/50 px-3 py-2 text-left"
                  >
                    {t("styleNo")}
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky left-[176px] z-20 min-w-[110px] border-r bg-muted/50 px-3 py-2 text-left"
                  >
                    {t("color")}
                  </th>
                  <th colSpan={grid.sizeNames.length} className="border-b px-2 py-1.5 text-left">
                    {t("size")}
                  </th>
                  <th rowSpan={2} className="border-l px-3 py-2 text-right">
                    {t("grandQty")}
                  </th>
                  <th rowSpan={2} className="px-3 py-2 text-right">
                    {t("unitPrice")}
                  </th>
                  <th rowSpan={2} className="px-3 py-2 text-right">
                    {t("amount")}
                  </th>
                  <th rowSpan={2} className="w-10 px-1 py-2" />
                </tr>
                <tr className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
                  {grid.sizeNames.map((name) => (
                    <th key={name} className="min-w-[56px] px-1 py-1.5 text-center">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row) => (
                  <tr
                    key={row.key}
                    className={`border-b last:border-0 ${row.firstOfProduct ? "border-t-2 border-t-muted" : ""}`}
                  >
                    {row.firstOfProduct && (
                      <>
                        <td
                          rowSpan={row.productRowSpan}
                          className="sticky left-0 z-10 bg-background px-2 py-1.5 align-top"
                        >
                          {row.thumbnail && (
                            <Link href={`/products/${row.productId}`}>
                              <img
                                src={row.thumbnail}
                                alt=""
                                className="h-10 w-10 rounded bg-white object-contain"
                              />
                            </Link>
                          )}
                        </td>
                        <td
                          rowSpan={row.productRowSpan}
                          className="sticky left-14 z-10 bg-background px-3 py-1.5 align-top"
                        >
                          <Link
                            href={`/products/${row.productId}`}
                            className="whitespace-nowrap font-mono font-medium hover:underline"
                          >
                            {row.productCode || "-"}
                          </Link>
                          {/* 품번만으로는 무엇인지 떠올리기 어려워 이름을 작게 곁들인다 */}
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {row.productName}
                          </p>
                        </td>
                      </>
                    )}
                    <td className="sticky left-[176px] z-10 whitespace-nowrap border-r bg-background px-3 py-1.5">
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
                    {grid.sizeNames.map((name) => {
                      const cell = row.cells[name]
                      // 이 스타일에 없는 사이즈는 막는다
                      if (!cell) {
                        return (
                          <td
                            key={name}
                            className="bg-muted/30 px-1 py-1.5 text-center text-muted-foreground/40"
                          >
                            –
                          </td>
                        )
                      }
                      const soldOut = cell.stock <= 0
                      return (
                        <td key={name} className="px-1 py-1.5 text-center">
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
                    <td className="border-l px-3 py-1.5 text-right tabular-nums">{row.totalQty}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {row.unitPriceMin === row.unitPriceMax
                        ? fp(row.unitPriceMin, row.priceCurrency)
                        : `${fp(row.unitPriceMin, row.priceCurrency)}~${fp(row.unitPriceMax, row.priceCurrency)}`}
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                      {fp(row.subtotal, row.priceCurrency)}
                    </td>
                    <td className="px-1 py-1.5">
                      {row.firstOfProduct && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title={t("productDelete")}
                          onClick={() => removeProduct(row.productId)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* 사이즈별 세로 합계. 사이즈 레인지별로 얼마나 담았는지 한눈에 본다. */}
              <tfoot>
                <tr className="border-t-2 bg-muted/50 font-medium">
                  <td
                    colSpan={3}
                    className="sticky left-0 z-10 border-r bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
                  >
                    {t("sizeTotal")}
                  </td>
                  {grid.sizeNames.map((name) => (
                    <td key={name} className="px-1 py-2 text-center tabular-nums">
                      {grid.columnTotals[name] || ""}
                    </td>
                  ))}
                  <td className="border-l px-3 py-2 text-right tabular-nums">{totalQty}</td>
                  <td />
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fp(supplyAmount, customerCurrency)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
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
