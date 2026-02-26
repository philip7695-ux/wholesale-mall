"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { toast } from "sonner"

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
  category: { name: string }
  colors: { id: string; name: string; colorCode: string | null; images: string[] }[]
  sizes: { id: string; name: string }[]
  variants: Variant[]
}

export function ProductDetail({ product }: { product: Product }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [selectedColor, setSelectedColor] = useState(product.colors[0]?.id || "")
  const allImages = product.images.length > 0
    ? product.images
    : product.thumbnail
      ? [product.thumbnail]
      : []
  const [mainImage, setMainImage] = useState(allImages[0] || "")
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)

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

  function totalAmount() {
    let sum = 0
    for (const [key, qty] of Object.entries(quantities)) {
      if (qty <= 0) continue
      const [colorId, sizeId] = key.split("-")
      const variant = getVariant(colorId, sizeId)
      if (variant) sum += variant.price * qty
    }
    return sum
  }

  // 선택된 컬러의 수량 합계
  function colorQuantity(colorId: string) {
    let qty = 0
    for (const size of product.sizes) {
      qty += quantities[`${colorId}-${size.id}`] || 0
    }
    return qty
  }

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
      toast.error("수량을 입력해주세요.")
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

      toast.success("장바구니에 추가되었습니다.")
      setQuantities({})
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류가 발생했습니다.")
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
          <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
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
                <CardTitle className="text-sm">사이즈 스펙 (cm)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        {sizeSpecData.headers.map((h) => (
                          <th key={h} className="px-2 py-1.5 text-center font-medium">{h}</th>
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
                <CardTitle className="text-sm">사이즈 스펙</CardTitle>
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
            <Badge variant="secondary">{product.category.name}</Badge>
            <h1 className="mt-2 text-2xl font-bold">{product.name}</h1>
          </div>

          {product.description && (
            <p className="text-muted-foreground">{product.description}</p>
          )}

          {/* 컬러 선택 */}
          <div className="space-y-2">
            <p className="text-sm font-medium">컬러 선택</p>
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
                      style={{ backgroundColor: color.colorCode || "#ccc" }}
                    />
                    {color.name}
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

          {/* 선택된 컬러의 사이즈/수량 입력 */}
          {currentColor && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span
                    className="inline-block h-3 w-3 rounded-full border"
                    style={{ backgroundColor: currentColor.colorCode || "#ccc" }}
                  />
                  {currentColor.name} - 사이즈별 수량
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {product.sizes.map((size) => {
                    const variant = getVariant(selectedColor, size.id)
                    const key = `${selectedColor}-${size.id}`
                    if (!variant) return null
                    return (
                      <div key={size.id} className="flex items-center gap-3">
                        <span className="w-14 text-sm font-medium">{size.name}</span>
                        <span className="w-20 text-xs text-muted-foreground">
                          {formatPrice(variant.price)}
                        </span>
                        <Input
                          type="number"
                          min={0}
                          value={quantities[key] || ""}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0
                            setQuantities((prev) => ({ ...prev, [key]: val }))
                          }}
                          placeholder="0"
                          className="h-8 w-20 text-center text-sm"
                        />
                        {(quantities[key] || 0) > 0 && (
                          <span className="text-sm font-medium">
                            {formatPrice(variant.price * (quantities[key] || 0))}
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
                            style={{ backgroundColor: color.colorCode || "#ccc" }}
                          />
                          {color.name}
                        </span>
                        <span>{qty}장</span>
                      </div>
                    )
                  })}
                  <div className="flex justify-between border-t pt-1 font-bold">
                    <span>합계 {totalQuantity()}장</span>
                    <span className="text-primary">{formatPrice(totalAmount())}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 장바구니 담기 */}
          <Button
            onClick={handleAddToCart}
            disabled={loading || totalQuantity() === 0}
            className="w-full"
            size="lg"
          >
            <ShoppingCart className="mr-2 h-4 w-4" />
            {loading
              ? "추가중..."
              : totalQuantity() > 0
                ? `장바구니 담기 (${totalQuantity()}장 · ${formatPrice(totalAmount())})`
                : "장바구니 담기"}
          </Button>
        </div>
      </div>
    </div>
  )
}
