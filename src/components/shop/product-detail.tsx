"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { formatPrice } from "@/lib/utils"
import { translateCategory, translateColor, translateSizeSpecHeader } from "@/lib/translate"
import { toast } from "sonner"
import { useCurrency } from "@/hooks/use-currency"
import { GRADE_DISCOUNT, GRADE_MOQ_RATE, getEffectiveMoq } from "@/lib/grade"
import { checkMoq } from "@/lib/moq"

interface Variant {
  id: string
  colorId: string
  sizeId: string
  price: number
  stock: number
  color: { id: string; name: string }
  size: { id: string; name: string }
}

interface Product {
  id: string
  name: string
  description: string | null
  thumbnail: string | null
  images: string[]
  sizeSpec: string | null
  moq: number
  colorMoq: number
  category: { name: string; slug: string }
  colors: { id: string; name: string; colorCode: string | null; hexColor: string | null; images: string[]; moq: number }[]
  sizes: { id: string; name: string }[]
  variants: Variant[]
}

export function ProductDetail({ product }: { product: Product }) {
  const { data: session } = useSession()
  const router = useRouter()
  const t = useTranslations("product")
  const tc = useTranslations("common")
  const tCat = useTranslations("categories")
  const tColor = useTranslations("colors")
  const tSpec = useTranslations("sizeSpec")
  const locale = useLocale()
  const { rate } = useCurrency()
  const tProd = useTranslations("product")
  const buyerGrade = session?.user?.buyerGrade || "BRONZE"
  const discountRate = GRADE_DISCOUNT[buyerGrade] || 0
  const [selectedColor, setSelectedColor] = useState(product.colors[0]?.id || "")
  const allImages = product.images.length > 0
    ? product.images
    : product.thumbnail
      ? [product.thumbnail]
      : []
  const [mainImage, setMainImage] = useState(allImages[0] || "")
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [showCartDialog, setShowCartDialog] = useState(false)

  const totalStock = product.variants.reduce((sum, v) => sum + v.stock, 0)
  const allSoldOut = totalStock <= 0
  const currentColor = product.colors.find((c) => c.id === selectedColor)

  function handleColorSelect(colorId: string) {
    setSelectedColor(colorId)
  }

  function getVariant(colorId: string, sizeId: string): Variant | undefined {
    return product.variants.find((v) => v.colorId === colorId && v.sizeId === sizeId)
  }

  function totalQuantity() {
    return Object.values(quantities).reduce((sum, q) => sum + q, 0)
  }

  function totalAmountOriginal() {
    let sum = 0
    for (const [key, qty] of Object.entries(quantities)) {
      if (qty <= 0) continue
      const [colorId, sizeId] = key.split("-")
      const variant = getVariant(colorId, sizeId)
      if (variant) sum += variant.price * qty
    }
    return sum
  }

  function totalAmount() {
    const original = totalAmountOriginal()
    return discountRate > 0 ? Math.round(original * (1 - discountRate)) : original
  }

  function colorQuantity(colorId: string) {
    let qty = 0
    for (const size of product.sizes) {
      qty += quantities[`${colorId}-${size.id}`] || 0
    }
    return qty
  }

  // MOQ 검증
  const hasMoq = product.moq > 0 || product.colorMoq > 0 || product.colors.some((c) => c.moq > 0)
  const moqGradeRate = GRADE_MOQ_RATE[buyerGrade] ?? 1.0
  const moqRelaxed = moqGradeRate < 1.0

  const moqResult = hasMoq
    ? checkMoq({
        productMoq: product.moq,
        colorMoq: product.colorMoq,
        colors: product.colors.map((c) => ({ colorId: c.id, colorName: translateColor(c.name, tColor), moq: c.moq })),
        quantities: Object.fromEntries(
          product.colors.map((color) => [color.id, colorQuantity(color.id)]),
        ),
        grade: buyerGrade,
      })
    : null

  async function handleAddToCart() {
    if (!session) {
      router.push("/auth/login")
      return
    }

    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([key, qty]) => {
        const [colorId, sizeId] = key.split("-")
        const variant = getVariant(colorId, sizeId)
        return { variantId: variant!.id, quantity: qty }
      })

    if (items.length === 0) {
      toast.error(t("enterQuantity"))
      return
    }

    if (moqResult && !moqResult.valid) {
      toast.error(t("moqNotMet"))
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      setQuantities({})
      setShowCartDialog(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc("error"))
    }
    setLoading(false)
  }

  // sizeSpec 파싱 (JSON 테이블 형태)
  let sizeSpecData: { headers: string[]; rows: Record<string, string>[] } | null = null
  if (product.sizeSpec) {
    try {
      sizeSpecData = JSON.parse(product.sizeSpec)
    } catch {
      // plain text fallback
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* 이미지 갤러리 */}
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
            {mainImage ? (
              <img
                src={mainImage}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No Image
              </div>
            )}
            {allImages.length > 1 && (
              <>
                <button
                  onClick={() => {
                    const idx = allImages.indexOf(mainImage)
                    setMainImage(allImages[(idx - 1 + allImages.length) % allImages.length])
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60 transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => {
                    const idx = allImages.indexOf(mainImage)
                    setMainImage(allImages[(idx + 1) % allImages.length])
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60 transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white">
                  {allImages.indexOf(mainImage) + 1} / {allImages.length}
                </div>
              </>
            )}
          </div>
          {/* 썸네일 리스트 */}
          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {allImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setMainImage(img)}
                  className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded border-2 transition-colors ${
                    mainImage === img ? "border-primary" : "border-transparent hover:border-gray-300"
                  }`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* 사이즈 스펙 */}
          {sizeSpecData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("sizeSpecCm")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        {sizeSpecData.headers.map((h) => (
                          <th key={h} className="px-2 py-1.5 text-center font-medium">{translateSizeSpecHeader(h, tSpec)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sizeSpecData.rows.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          {sizeSpecData!.headers.map((h) => (
                            <td key={h} className="px-2 py-1.5 text-center">{row[h] || "-"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
          {product.sizeSpec && !sizeSpecData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("sizeSpec")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{product.sizeSpec}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 상품 정보 + 컬러 선택 + 주문 */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{translateCategory(product.category.slug, tCat)}</Badge>
              {allSoldOut && (
                <Badge variant="destructive">{t("soldOut")}</Badge>
              )}
              {discountRate > 0 && (
                <Badge variant="destructive">
                  {tProd("gradeDiscountBadge", { rate: Math.round(discountRate * 100) })}
                </Badge>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-bold">{product.name}</h1>
          </div>

          {product.description && (
            <p className="text-muted-foreground">{product.description}</p>
          )}

          {/* 컬러 선택 */}
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("colorSelect")}</p>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((color) => {
                const qty = colorQuantity(color.id)
                return (
                  <button
                    key={color.id}
                    onClick={() => handleColorSelect(color.id)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                      selectedColor === color.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted"
                    }`}
                  >
                    <span
                      className="inline-block h-4 w-4 rounded-full border"
                      style={{ backgroundColor: color.hexColor || "#ccc" }}
                    />
                    {translateColor(color.name, tColor)}
                    {qty > 0 && (
                      <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                        {qty}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* MOQ 안내 */}
          {hasMoq && moqResult && (
            <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30">
              <CardContent className="py-3">
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">{t("moqTitle")}</p>
                  {moqResult.productMoqRequired > 0 && (
                    <p className="text-amber-700 dark:text-amber-300">
                      {t("moqProduct", { qty: moqResult.productMoqRequired })}
                    </p>
                  )}
                  {product.colors.map((color) => {
                    const rawColorMoq = color.moq > 0 ? color.moq : product.colorMoq
                    if (rawColorMoq <= 0) return null
                    const effectiveMoq = getEffectiveMoq(rawColorMoq, buyerGrade)
                    return (
                      <p key={color.id} className="text-amber-700 dark:text-amber-300">
                        {t("moqColor", { colorName: translateColor(color.name, tColor), qty: effectiveMoq })}
                      </p>
                    )
                  })}
                  {moqRelaxed && (
                    <p className="text-amber-600 dark:text-amber-400 text-xs">
                      {t("moqGradeRelaxed", { rate: Math.round((1 - moqGradeRate) * 100) })}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 선택된 컬러의 사이즈/수량 입력 */}
          {currentColor && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full border"
                    style={{ backgroundColor: currentColor.hexColor || "#ccc" }}
                  />
                  {t("sizeQuantity", { colorName: translateColor(currentColor.name, tColor) })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {product.sizes.map((size) => {
                    const variant = getVariant(selectedColor, size.id)
                    const key = `${selectedColor}-${size.id}`
                    if (!variant) return null
                    const outOfStock = variant.stock <= 0
                    return (
                      <div key={size.id} className={`flex items-center gap-3 ${outOfStock ? "opacity-50" : ""}`}>
                        <span className="w-14 text-sm font-medium">{size.name}</span>
                        <span className="w-24 text-xs text-muted-foreground">
                          {discountRate > 0 ? (
                            <>
                              <span className="line-through">{formatPrice(variant.price, locale, rate)}</span>
                              {" "}
                              <span className="text-primary font-medium">
                                {formatPrice(Math.round(variant.price * (1 - discountRate)), locale, rate)}
                              </span>
                            </>
                          ) : (
                            formatPrice(variant.price, locale, rate)
                          )}
                        </span>
                        <span className={`w-16 text-xs text-center ${outOfStock ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                          {outOfStock ? t("soldOut") : t("stockCount", { count: variant.stock })}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          max={variant.stock > 0 ? variant.stock : undefined}
                          value={quantities[key] || ""}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0
                            const capped = variant.stock > 0 ? Math.min(val, variant.stock) : val
                            setQuantities((prev) => ({ ...prev, [key]: capped }))
                          }}
                          placeholder="0"
                          disabled={outOfStock}
                          className="h-8 w-20 text-center text-sm"
                        />
                        {(quantities[key] || 0) > 0 && (
                          <span className="text-sm font-medium">
                            {formatPrice(
                              Math.round(variant.price * (1 - discountRate)) * (quantities[key] || 0),
                              locale,
                              rate,
                            )}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 전체 주문 요약 (다른 컬러 포함) */}
          {totalQuantity() > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-3">
                <div className="space-y-1 text-sm">
                  {product.colors.map((color) => {
                    const qty = colorQuantity(color.id)
                    if (qty === 0) return null
                    return (
                      <div key={color.id} className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full border"
                            style={{ backgroundColor: color.hexColor || "#ccc" }}
                          />
                          {translateColor(color.name, tColor)}
                        </span>
                        <span>{qty}{tc("pieces")}</span>
                      </div>
                    )
                  })}
                  <div className="flex justify-between border-t pt-1 font-bold">
                    <span>{t("totalSummary", { count: totalQuantity() })}</span>
                    <span className="text-primary">{formatPrice(totalAmount(), locale, rate)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* MOQ 미달 에러 메시지 */}
          {moqResult && !moqResult.valid && totalQuantity() > 0 && (
            <Card className="border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30">
              <CardContent className="py-3">
                <div className="space-y-1 text-sm">
                  <p className="flex items-center gap-1.5 font-medium text-red-800 dark:text-red-200">
                    <AlertTriangle className="h-4 w-4" />
                    {t("moqNotMet")}
                  </p>
                  {moqResult.productMoqRequired > 0 && moqResult.productQtyTotal < moqResult.productMoqRequired && (
                    <p className="text-red-700 dark:text-red-300">
                      {t("moqProductError", { required: moqResult.productMoqRequired, actual: moqResult.productQtyTotal })}
                    </p>
                  )}
                  {moqResult.colorErrors.map((err) => (
                    <p key={err.colorId} className="text-red-700 dark:text-red-300">
                      {t("moqColorError", { colorName: err.colorName, required: err.required, actual: err.actual })}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 장바구니 담기 */}
          <Button
            onClick={handleAddToCart}
            disabled={loading || allSoldOut || totalQuantity() === 0 || (moqResult != null && !moqResult.valid)}
            className="w-full"
            size="lg"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {loading
              ? t("adding")
              : totalQuantity() > 0
                ? t("addToCartWithQty", { count: totalQuantity(), price: formatPrice(totalAmount(), locale, rate) })
                : t("addToCart")}
          </Button>
        </div>
      </div>

      {/* 장바구니 담기 완료 팝업 */}
      <Dialog open={showCartDialog} onOpenChange={setShowCartDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              {t("addedToCart")}
            </DialogTitle>
            <DialogDescription>
              {product.name}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCartDialog(false)}
            >
              {t("continueShopping")}
            </Button>
            <Button
              onClick={() => router.push("/cart")}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              {t("goToCart")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
