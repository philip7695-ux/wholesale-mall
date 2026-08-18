"use client"

import { useState, useRef, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Input } from "@/components/ui/input"
import { ShoppingCart, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { formatPriceCross } from "@/lib/utils"
import { translateCategory, translateColor, translateSizeSpecHeader, getColorHex } from "@/lib/translate"
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
  code: string | null
  description: string | null
  thumbnail: string | null
  images: string[]
  sizeSpec: string | null
  moq: number
  colorMoq: number
  priceCurrency: string
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
  const { rates } = useCurrency()
  const fp = (amount: number) => formatPriceCross(amount, product.priceCurrency, locale, rates)
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
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({ display: "none" })
  const imgContainerRef = useRef<HTMLDivElement>(null)

  const ZOOM_SCALE = 2.5

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = imgContainerRef.current
    if (!container || !mainImage) return
    const rect = container.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setZoomStyle({
      display: "block",
      backgroundImage: `url(${mainImage})`,
      backgroundSize: `${rect.width * ZOOM_SCALE}px ${rect.height * ZOOM_SCALE}px`,
      backgroundPosition: `${x}% ${y}%`,
    })
  }, [mainImage])

  const handleMouseLeave = useCallback(() => {
    setZoomStyle({ display: "none" })
  }, [])

  const minPrice = product.variants.length > 0
    ? Math.round(Math.min(...product.variants.map((v) => v.price)) * (1 - discountRate) * 100) / 100
    : 0
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
    <div className="space-y-8 overflow-x-hidden">
      <div className="grid gap-10 md:grid-cols-2">
        {/* 이미지 갤러리 */}
        <div className="space-y-3">
          <div
            ref={imgContainerRef}
            className="relative aspect-square overflow-hidden bg-white cursor-crosshair"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {mainImage ? (
              <img
                src={mainImage}
                alt={product.name}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-gray-300 text-sm">
                No Image
              </div>
            )}
            {/* hover zoom overlay */}
            <div
              className="absolute inset-0 pointer-events-none cursor-crosshair"
              style={zoomStyle}
            />
            {allImages.length > 1 && (
              <>
                <button
                  onClick={() => {
                    const idx = allImages.indexOf(mainImage)
                    setMainImage(allImages[(idx - 1 + allImages.length) % allImages.length])
                  }}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 p-2 text-[#1A1A1A] hover:bg-white transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    const idx = allImages.indexOf(mainImage)
                    setMainImage(allImages[(idx + 1) % allImages.length])
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 p-2 text-[#1A1A1A] hover:bg-white transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/80 px-3 py-1 text-xs text-[#1A1A1A]">
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
                  className={`h-16 w-16 flex-shrink-0 overflow-hidden border transition-colors ${
                    mainImage === img ? "border-[#1A1A1A]" : "border-transparent hover:border-gray-300"
                  }`}
                >
                  <img src={img} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 상품 정보 + 컬러 선택 + 주문 */}
        <div className="space-y-6">
          {/* 상품 기본 정보 */}
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">
                {translateCategory(product.category.slug, tCat, product.category.name)}
              </span>
              {allSoldOut && (
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-red-500">
                  {t("soldOut")}
                </span>
              )}
              {discountRate > 0 && (
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-red-500">
                  {tProd("gradeDiscountBadge", { rate: Math.round(discountRate * 100) })}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-light tracking-tight text-[#1A1A1A]">{product.name}</h1>
            {product.code && (
              <p className="mt-1.5 text-xs font-light tracking-wider text-gray-400">{product.code}</p>
            )}
            <p className="mt-3 text-lg text-[#1A1A1A]">
              {fp(minPrice)}~
            </p>
          </div>

          {product.description && (
            <p className="text-sm font-light text-gray-500 leading-relaxed">{product.description}</p>
          )}

          {/* 사이즈 스펙 */}
          {sizeSpecData && (
            <div className="border-t border-gray-200 pt-5">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">{t("sizeSpecCm")}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {sizeSpecData.headers.map((h) => (
                        <th key={h} className="px-3 py-2 text-center font-medium text-gray-500">{translateSizeSpecHeader(h, tSpec)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sizeSpecData.rows.map((row, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0">
                        {sizeSpecData!.headers.map((h) => (
                          <td key={h} className="px-3 py-2 text-center text-gray-500">{row[h] || "-"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {product.sizeSpec && !sizeSpecData && (
            <div className="border-t border-gray-200 pt-5">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">{t("sizeSpec")}</p>
              <p className="whitespace-pre-wrap text-sm font-light text-gray-500">{product.sizeSpec}</p>
            </div>
          )}

          {/* 컬러 선택 */}
          <div className="border-t border-gray-200 pt-5 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{t("colorSelect")}</p>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((color) => {
                const qty = colorQuantity(color.id)
                return (
                  <button
                    key={color.id}
                    onClick={() => handleColorSelect(color.id)}
                    className={`flex items-center gap-2 border px-3 py-2 text-sm transition-colors ${
                      selectedColor === color.id
                        ? "border-[#1A1A1A] text-[#1A1A1A]"
                        : "border-gray-200 text-gray-500 hover:border-gray-400"
                    }`}
                  >
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full border border-gray-300"
                      style={{ backgroundColor: getColorHex(color.name, color.hexColor) }}
                    />
                    <span className="font-light">{translateColor(color.name, tColor)}</span>
                    {qty > 0 && (
                      <span className="bg-[#1A1A1A] text-white text-[10px] px-1.5 py-0.5">
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
            <div className="border-l-2 border-amber-400 bg-amber-50/50 px-4 py-3">
              <div className="space-y-1 text-sm">
                <p className="font-medium text-amber-800">{t("moqTitle")}</p>
                {moqResult.productMoqRequired > 0 && (
                  <p className="text-amber-700 font-light">
                    {t("moqProduct", { qty: moqResult.productMoqRequired })}
                  </p>
                )}
                {product.colors.map((color) => {
                  const rawColorMoq = color.moq > 0 ? color.moq : product.colorMoq
                  if (rawColorMoq <= 0) return null
                  const effectiveMoq = getEffectiveMoq(rawColorMoq, buyerGrade)
                  return (
                    <p key={color.id} className="text-amber-700 font-light">
                      {t("moqColor", { colorName: translateColor(color.name, tColor), qty: effectiveMoq })}
                    </p>
                  )
                })}
                {moqRelaxed && (
                  <p className="text-amber-600 text-xs font-light">
                    {t("moqGradeRelaxed", { rate: Math.round((1 - moqGradeRate) * 100) })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 선택된 컬러의 사이즈/수량 입력 */}
          {currentColor && (
            <div className="border-t border-gray-200 pt-5">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full border border-gray-300"
                  style={{ backgroundColor: getColorHex(currentColor.name, currentColor.hexColor) }}
                />
                {t("sizeQuantity", { colorName: translateColor(currentColor.name, tColor) })}
              </p>
              <div className="space-y-2">
                {product.sizes.map((size) => {
                  const variant = getVariant(selectedColor, size.id)
                  const key = `${selectedColor}-${size.id}`
                  if (!variant) return null
                  const outOfStock = variant.stock <= 0
                  return (
                    <div key={size.id} className={`flex items-center gap-2 sm:gap-3 py-1.5 ${outOfStock ? "opacity-40" : ""}`}>
                      <span className="w-10 sm:w-14 text-xs sm:text-sm font-medium text-[#1A1A1A] shrink-0">{size.name}</span>
                      <span className="hidden sm:inline w-24 text-xs text-[#1A1A1A] shrink-0">
                        {discountRate > 0 ? (
                          <>
                            <span className="line-through text-gray-400">{fp(variant.price)}</span>
                            {" "}
                            <span className="text-[#1A1A1A] font-medium">
                              {fp(Math.round(variant.price * (1 - discountRate) * 100) / 100)}
                            </span>
                          </>
                        ) : (
                          fp(variant.price)
                        )}
                      </span>
                      <span className={`w-12 sm:w-16 text-xs text-center shrink-0 ${outOfStock ? "text-red-500 font-medium" : "text-gray-500"}`}>
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
                        className="h-8 w-16 sm:w-20 text-center text-sm border-gray-200"
                      />
                      {(quantities[key] || 0) > 0 && (
                        <span className="text-xs sm:text-sm text-[#1A1A1A] shrink-0">
                          {fp(
                            Math.round(variant.price * (1 - discountRate) * 100) / 100 * (quantities[key] || 0),
                          )}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 전체 주문 요약 */}
          {totalQuantity() > 0 && (
            <div className="bg-gray-50 px-5 py-4">
              <div className="space-y-1.5 text-sm">
                {product.colors.map((color) => {
                  const qty = colorQuantity(color.id)
                  if (qty === 0) return null
                  return (
                    <div key={color.id} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-light text-gray-500">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full border border-gray-300"
                          style={{ backgroundColor: getColorHex(color.name, color.hexColor) }}
                        />
                        {translateColor(color.name, tColor)}
                      </span>
                      <span className="font-light text-gray-500">{qty}{tc("pieces")}</span>
                    </div>
                  )
                })}
                <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                  <span className="text-[#1A1A1A]">{t("totalSummary", { count: totalQuantity() })}</span>
                  <span className="text-[#1A1A1A] font-medium">{fp(totalAmount())}</span>
                </div>
              </div>
            </div>
          )}

          {/* MOQ 미달 에러 */}
          {moqResult && !moqResult.valid && totalQuantity() > 0 && (
            <div className="border-l-2 border-red-400 bg-red-50/50 px-4 py-3">
              <div className="space-y-1 text-sm">
                <p className="flex items-center gap-1.5 font-medium text-red-700">
                  <AlertTriangle className="h-4 w-4" />
                  {t("moqNotMet")}
                </p>
                {moqResult.productMoqRequired > 0 && moqResult.productQtyTotal < moqResult.productMoqRequired && (
                  <p className="text-red-600 font-light">
                    {t("moqProductError", { required: moqResult.productMoqRequired, actual: moqResult.productQtyTotal })}
                  </p>
                )}
                {moqResult.colorErrors.map((err) => (
                  <p key={err.colorId} className="text-red-600 font-light">
                    {t("moqColorError", { colorName: err.colorName, required: err.required, actual: err.actual })}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* 장바구니 담기 */}
          <button
            onClick={handleAddToCart}
            disabled={loading || allSoldOut || totalQuantity() === 0 || (moqResult != null && !moqResult.valid)}
            className="w-full flex items-center justify-center gap-2 bg-[#1A1A1A] py-4 text-sm font-medium uppercase tracking-widest text-white transition-transform active:scale-95 hover:bg-[#333] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShoppingCart className="h-4 w-4" />
            {loading
              ? t("adding")
              : totalQuantity() > 0
                ? t("addToCartWithQty", { count: totalQuantity(), price: fp(totalAmount()) })
                : t("addToCart")}
          </button>
        </div>
      </div>

      {/* 장바구니 담기 완료 팝업 */}
      <Dialog open={showCartDialog} onOpenChange={setShowCartDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1A1A1A]">
              <CheckCircle className="h-5 w-5 text-green-500" />
              {t("addedToCart")}
            </DialogTitle>
            <DialogDescription>
              {product.name}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center gap-2">
            <button
              onClick={() => setShowCartDialog(false)}
              className="px-6 py-3 text-sm font-medium uppercase tracking-widest text-[#1A1A1A] border border-gray-200 hover:border-[#1A1A1A] transition-colors"
            >
              {t("continueShopping")}
            </button>
            <button
              onClick={() => router.push("/cart")}
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium uppercase tracking-widest text-white bg-[#1A1A1A] hover:bg-[#333] transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              {t("goToCart")}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
