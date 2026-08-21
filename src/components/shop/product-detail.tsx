"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Input } from "@/components/ui/input"
import { ShoppingCart, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Plus, Minus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { formatPriceCross } from "@/lib/utils"
import { translateMaterial, translateOrigin } from "@/lib/product-i18n"
import { translateCategory, translateColor, translateSizeSpecHeader } from "@/lib/translate"
import { toast } from "sonner"
import { useCurrency } from "@/hooks/use-currency"
import { GRADE_DISCOUNT, GRADE_MOQ_RATE, getEffectiveMoq } from "@/lib/grade"
import { checkMoq } from "@/lib/moq"

interface Variant {
  tagPrice?: number
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
  material: string | null
  origin: string | null
  moq: number
  colorMoq: number
  priceCurrency: string
  showSrp?: boolean
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
  // 가격은 서버에서 시즌·등급 할인을 이미 적용해 넘겨준다.
  // 여기서 다시 곱하면 이중 할인이 된다. 배지 표시에만 쓴다.
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
  const [zoomStyle, setZoomStyle] = useState<React.CSSProperties>({ opacity: 0 })
  const [zoomActive, setZoomActive] = useState(false)
  const [hint, setHint] = useState<{ x: number; y: number } | null>(null)
  const imgContainerRef = useRef<HTMLDivElement>(null)

  const ZOOM_SCALE = 2.2

  // 이미지는 object-contain 이라 컨테이너를 꽉 채우지 않는다.
  // 실제로 그려진 영역을 기준으로 해야 확대 위치가 커서와 맞는다.
  const paintedRect = useCallback((rect: DOMRect) => {
    const img = imgContainerRef.current?.querySelector("img")
    const nw = img?.naturalWidth ?? 0
    const nh = img?.naturalHeight ?? 0
    if (!nw || !nh) return { left: 0, top: 0, width: rect.width, height: rect.height }
    const scale = Math.min(rect.width / nw, rect.height / nh)
    const width = nw * scale
    const height = nh * scale
    return { left: (rect.width - width) / 2, top: (rect.height - height) / 2, width, height }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = imgContainerRef.current
    if (!container || !mainImage) return
    const rect = container.getBoundingClientRect()
    const p = paintedRect(rect)
    const px = e.clientX - rect.left - p.left
    const py = e.clientY - rect.top - p.top
    const inside = px >= 0 && py >= 0 && px <= p.width && py <= p.height

    // 이미지 바깥(여백)에서는 아무것도 하지 않는다
    if (!inside) {
      setHint(null)
      if (zoomActive) setZoomStyle((prev) => ({ ...prev, opacity: 0 }))
      return
    }

    setHint({ x: e.clientX - rect.left, y: e.clientY - rect.top })

    if (!zoomActive) return
    setZoomStyle({
      opacity: 1,
      backgroundImage: `url(${mainImage})`,
      backgroundSize: `${p.width * ZOOM_SCALE}px ${p.height * ZOOM_SCALE}px`,
      backgroundPosition: `${(px / p.width) * 100}% ${(py / p.height) * 100}%`,
      backgroundRepeat: "no-repeat",
      backgroundColor: "#fff",
    })
  }, [mainImage, zoomActive, paintedRect])

  const handleMouseLeave = useCallback(() => {
    setHint(null)
    setZoomActive(false)
    setZoomStyle({ opacity: 0 })
  }, [])

  // 클릭할 때만 확대한다. 커서가 지나가기만 해도 확대되면 산만하다.
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = imgContainerRef.current
    if (!container || !mainImage) return
    const rect = container.getBoundingClientRect()
    const p = paintedRect(rect)
    const px = e.clientX - rect.left - p.left
    const py = e.clientY - rect.top - p.top
    if (px < 0 || py < 0 || px > p.width || py > p.height) return

    if (zoomActive) {
      setZoomActive(false)
      setZoomStyle({ opacity: 0 })
      return
    }
    setZoomActive(true)
    setZoomStyle({
      opacity: 1,
      backgroundImage: `url(${mainImage})`,
      backgroundSize: `${p.width * ZOOM_SCALE}px ${p.height * ZOOM_SCALE}px`,
      backgroundPosition: `${(px / p.width) * 100}% ${(py / p.height) * 100}%`,
      backgroundRepeat: "no-repeat",
      backgroundColor: "#fff",
    })
  }, [mainImage, zoomActive, paintedRect])

  // 다른 이미지로 바꾸면 확대를 해제한다
  useEffect(() => {
    setZoomActive(false)
    setZoomStyle({ opacity: 0 })
  }, [mainImage])

  const prices = product.variants.map((v) => v.price)
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0
  // 권장 최소 판매가 = 한국 택가(정상가) 중 최저. 신상에만, 그리고
  // 도매가보다 실제로 높을 때만 보여준다(같으면 뜻이 없다).
  const tagPrices = product.variants.map((v) => v.tagPrice ?? 0).filter((n) => n > 0)
  const minTag = tagPrices.length > 0 ? Math.min(...tagPrices) : 0
  const showSrp = !!product.showSrp && minTag > minPrice
  // 사이즈·컬러에 따라 가격이 갈릴 때만 "~" 를 붙인다.
  // 지금은 전 상품이 단일 가격이라 항상 붙으면 뜻 없는 기호가 된다.
  const hasPriceRange = prices.length > 0 && Math.max(...prices) !== minPrice
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
    // 단가에 이미 할인이 반영돼 있으므로 합계에 다시 곱하지 않는다
    return Math.round(totalAmountOriginal())
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
            className={`relative aspect-square overflow-hidden bg-white ${
              zoomActive ? "cursor-zoom-out" : "cursor-zoom-in"
            }`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleImageClick}
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
              className="absolute inset-0 pointer-events-none transition-opacity duration-200 ease-out"
              style={zoomStyle}
            />
            {/* 커서를 따라다니는 확대 안내. 클릭해야 확대된다 */}
            {hint && (
              <div
                className="pointer-events-none absolute z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-md ring-1 ring-black/5 backdrop-blur-sm transition-opacity duration-150"
                style={{ left: hint.x, top: hint.y, transform: "translate(-50%, -50%)" }}
              >
                {zoomActive ? (
                  <Minus className="h-4 w-4 text-[#1A1A1A]" strokeWidth={1.5} />
                ) : (
                  <Plus className="h-4 w-4 text-[#1A1A1A]" strokeWidth={1.5} />
                )}
              </div>
            )}
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
              {fp(minPrice)}{hasPriceRange && "~"}
            </p>
            {/* 신상 권장 최소 판매가(하한선). 강제 아님, 참고용. */}
            {showSrp && (
              <p className="mt-1 text-xs font-light text-gray-400">
                {t("srpLabel")} {fp(minTag)}
                <span className="ml-1 text-gray-300">· {t("srpNote")}</span>
              </p>
            )}
          </div>

          {product.description && (
            <p className="text-sm font-light text-gray-500 leading-relaxed">{product.description}</p>
          )}

          {/* 혼용률·원산지. B2B 바이어는 통관·상품 등록에 이 값이 꼭 필요하다. */}
          {(product.material || product.origin) && (
            <dl className="space-y-2 border-t border-gray-200 pt-5 text-sm">
              {product.material && (
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 font-medium text-gray-400">{t("material")}</dt>
                  <dd className="whitespace-pre-wrap font-light text-gray-600">{translateMaterial(product.material, locale)}</dd>
                </div>
              )}
              {product.origin && (
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 font-medium text-gray-400">{t("origin")}</dt>
                  <dd className="font-light text-gray-600">{translateOrigin(product.origin, locale)}</dd>
                </div>
              )}
            </dl>
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
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">
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
                        {fp(variant.price)}
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
                          {fp(variant.price * (quantities[key] || 0))}
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
                      <span className="font-light text-gray-500">
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
