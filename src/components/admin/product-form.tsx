"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, X, Upload } from "lucide-react"
import { toast } from "sonner"
import { translateCategory } from "@/lib/translate"
import { SUPPORTED_CURRENCIES } from "@/lib/currency"
import { ADULT_SIZES, KIDS_NUM_SIZES, KIDS_LETTER_SIZES, ALL_SIZES } from "@/lib/product-sizes"

const KIDS_SIZES_ALL = [...KIDS_LETTER_SIZES, ...KIDS_NUM_SIZES]
const ALL_SIZE_ORDER = ALL_SIZES

// 사이즈 프리셋 그룹
const SIZE_PRESETS: { label: string; sizes: string[] }[] = [
  { label: "성인복 (XS~3XL)", sizes: ADULT_SIZES.filter((s) => s !== "FREE") },
  { label: "성인복 FREE", sizes: ["FREE"] },
  { label: "유아 (80~100)", sizes: ["80", "85", "90", "95", "100"] },
  { label: "아동 (100~140)", sizes: ["100", "110", "120", "130", "140"] },
  { label: "아동 영어 (F,S,M,L)", sizes: KIDS_LETTER_SIZES },
]

interface Category {
  id: string
  name: string
  slug: string
}

interface ColorInput {
  name: string
  colorCode: string
  hexColor: string
  moq: number
}

interface SizeInput {
  name: string
}

interface VariantInput {
  colorName: string
  sizeName: string
  price: number
  stock: number
}

interface ProductFormProps {
  categories: Category[]
  initialData?: {
    id: string
    code: string | null
    name: string
    description: string | null
    categoryId: string
    thumbnail: string | null
    images: string[]
    material: string | null
    sizeSpec: string | null
    isActive: boolean
    moq: number
    colorMoq: number
    priceCurrency: string
    colors: { name: string; colorCode: string | null; hexColor: string | null; images: string[]; moq: number }[]
    sizes: { name: string }[]
    variants: { color: { name: string }; size: { name: string }; price: number; stock: number }[]
  }
}

export function ProductForm({ categories, initialData }: ProductFormProps) {
  const router = useRouter()
  const t = useTranslations("admin")
  const tp = useTranslations("product")
  const tc = useTranslations("common")
  const tCat = useTranslations("categories")
  const isEdit = !!initialData

  const [priceCurrency, setPriceCurrency] = useState(initialData?.priceCurrency || "KRW")
  const [code, setCode] = useState(initialData?.code || "")
  const [name, setName] = useState(initialData?.name || "")
  const [description, setDescription] = useState(initialData?.description || "")
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || "")
  const [images, setImages] = useState<string[]>(initialData?.images || [])
  const [material, setMaterial] = useState(initialData?.material || "")
  const [sizeSpec, setSizeSpec] = useState(initialData?.sizeSpec || "")
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true)
  const [moq, setMoq] = useState(initialData?.moq || 0)
  const [colorMoq, setColorMoq] = useState(initialData?.colorMoq || 0)
  const [colors, setColors] = useState<ColorInput[]>(
    initialData?.colors.map((c) => ({
      name: c.name,
      colorCode: c.colorCode || "",
      hexColor: c.hexColor || "",
      moq: c.moq || 0,
    })) || [{ name: "", colorCode: "", hexColor: "", moq: 0 }],
  )
  const [sizes, setSizes] = useState<SizeInput[]>(
    initialData?.sizes.map((s) => ({ name: s.name })) || [{ name: "" }],
  )
  const [defaultPrice, setDefaultPrice] = useState(
    initialData?.variants[0]?.price || 0,
  )
  const [variantPrices, setVariantPrices] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    if (initialData?.variants) {
      for (const v of initialData.variants) {
        map[`${v.color.name}-${v.size.name}`] = v.price
      }
    }
    return map
  })
  const [variantStocks, setVariantStocks] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    if (initialData?.variants) {
      for (const v of initialData.variants) {
        map[`${v.color.name}-${v.size.name}`] = v.stock
      }
    }
    return map
  })

  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function uploadFile(file: File): Promise<string> {
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch("/api/upload", { method: "POST", body: formData })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    return data.url
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    for (const file of Array.from(files)) {
      try {
        const url = await uploadFile(file)
        setImages((prev) => [...prev, url])
      } catch {
        toast.error(t("uploadFail", { name: file.name }))
      }
    }
    e.target.value = ""
    setUploading(false)
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  function addColor() {
    setColors([...colors, { name: "", colorCode: "", hexColor: "", moq: 0 }])
  }

  function removeColor(index: number) {
    setColors(colors.filter((_, i) => i !== index))
  }

  const [customSize, setCustomSize] = useState("")

  function toggleSize(name: string) {
    if (sizes.some((s) => s.name === name)) {
      setSizes(sizes.filter((s) => s.name !== name))
    } else {
      const next = [...sizes, { name }].sort((a, b) => {
        const ai = ALL_SIZE_ORDER.indexOf(a.name)
        const bi = ALL_SIZE_ORDER.indexOf(b.name)
        if (ai === -1 && bi === -1) return 0
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
      setSizes(next)
    }
  }

  function addCustomSize() {
    const name = customSize.trim()
    if (!name || sizes.some((s) => s.name === name)) return
    setSizes([...sizes, { name }])
    setCustomSize("")
  }

  function removeCustomSize(name: string) {
    setSizes(sizes.filter((s) => s.name !== name))
  }

  function getVariantPrice(colorName: string, sizeName: string): number {
    return variantPrices[`${colorName}-${sizeName}`] ?? defaultPrice
  }

  function getVariantStock(colorName: string, sizeName: string): number {
    return variantStocks[`${colorName}-${sizeName}`] ?? 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !categoryId) {
      toast.error(t("productNameRequired"))
      return
    }

    const validColors = colors.filter((c) => c.name.trim())
    const validSizes = sizes.filter((s) => s.name.trim())

    if (validColors.length === 0 || validSizes.length === 0) {
      toast.error(t("colorSizeRequired"))
      return
    }

    const variants: VariantInput[] = []
    for (const color of validColors) {
      for (const size of validSizes) {
        variants.push({
          colorName: color.name,
          sizeName: size.name,
          price: getVariantPrice(color.name, size.name),
          stock: getVariantStock(color.name, size.name),
        })
      }
    }

    setLoading(true)
    try {
      const body = {
        name,
        code: code.trim() || null,
        description,
        categoryId,
        thumbnail: images[0] || null,
        images,
        material: material.trim() || null,
        sizeSpec: sizeSpec || null,
        isActive,
        moq,
        colorMoq,
        priceCurrency,
        colors: validColors.map((c) => ({ name: c.name, colorCode: c.colorCode || null, hexColor: c.hexColor || null, moq: c.moq, images: [] })),
        sizes: validSizes,
        variants,
      }

      const url = isEdit ? `/api/products/${initialData.id}` : "/api/products"
      const method = isEdit ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      toast.success(isEdit ? t("productUpdated") : t("productCreated"))
      router.push("/admin/products")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc("error"))
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t("basicInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label>{t("productCode")}</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("productCodePlaceholder")} />
            </div>
            <div className="space-y-2">
              <Label>{t("productName")} *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>{t("priceCurrency") || "가격 통화"}</Label>
              <Select value={priceCurrency} onValueChange={setPriceCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("category")} *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("categoryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {translateCategory(cat.slug, tCat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("productDesc")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>{tp("composition")}</Label>
            <Input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder={tp("compositionPlaceholder")} />
          </div>

          {/* Product Images */}
          <div className="space-y-2">
            <Label>{t("productImages")}</Label>
            <div className="flex flex-wrap gap-3">
              {images.map((img, i) => (
                <div key={i} className="relative">
                  <img src={img} alt="" className="h-20 w-20 rounded-md object-cover border" />
                  {i === 0 && (
                    <span className="absolute -top-1.5 -left-1.5 rounded bg-primary px-1 text-[10px] text-primary-foreground">
                      {t("mainImage")}
                    </span>
                  )}
                  <button
                    type="button"
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-destructive p-0.5 text-white"
                    onClick={() => removeImage(i)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed hover:bg-muted transition-colors">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground mt-1">
                  {uploading ? t("uploading") : t("add")}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </label>
            </div>
            {images.length > 0 && (
              <p className="text-xs text-muted-foreground">{t("imagesUploaded", { count: images.length })}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <Label htmlFor="isActive">{t("saleActive")}</Label>
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("color")}</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addColor}>
            <Plus className="mr-1 h-3 w-3" /> {t("addColor")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {colors.map((color, i) => (
            <div key={i} className="flex items-center gap-3">
              <Input
                placeholder={t("colorPlaceholder")}
                value={color.name}
                onChange={(e) => {
                  const next = [...colors]
                  next[i].name = e.target.value
                  setColors(next)
                }}
                className="flex-1"
              />
              <Input
                placeholder={t("colorCodePlaceholder") || "코드 (예: 01, BK)"}
                value={color.colorCode}
                onChange={(e) => {
                  const next = [...colors]
                  next[i].colorCode = e.target.value
                  setColors(next)
                }}
                className="w-24"
              />
              <Input
                type="color"
                value={/^#[0-9A-Fa-f]{6}$/.test(color.hexColor) ? color.hexColor : "#000000"}
                onChange={(e) => {
                  const next = [...colors]
                  next[i].hexColor = e.target.value
                  setColors(next)
                }}
                className="h-10 w-14 p-1"
              />
              {colors.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeColor(i)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Sizes */}
      <Card>
        <CardHeader>
          <CardTitle>{t("size")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preset buttons */}
          <div>
            <p className="mb-2 text-sm text-muted-foreground">프리셋 선택 (클릭하면 해당 사이즈가 설정됩니다)</p>
            <div className="flex flex-wrap gap-2">
              {SIZE_PRESETS.map((preset) => {
                const allSelected = preset.sizes.every((s) => sizes.some((sz) => sz.name === s))
                return (
                  <Button
                    key={preset.label}
                    type="button"
                    variant={allSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (allSelected) {
                        // 해당 프리셋 사이즈 제거
                        setSizes(sizes.filter((s) => !preset.sizes.includes(s.name)))
                      } else {
                        // 해당 프리셋 사이즈 추가 (기존 유지 + 새로 추가)
                        const existing = new Set(sizes.map((s) => s.name))
                        const newSizes = [...sizes]
                        for (const name of preset.sizes) {
                          if (!existing.has(name)) {
                            newSizes.push({ name })
                          }
                        }
                        newSizes.sort((a, b) => {
                          const ai = ALL_SIZE_ORDER.indexOf(a.name)
                          const bi = ALL_SIZE_ORDER.indexOf(b.name)
                          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
                        })
                        setSizes(newSizes)
                      }
                    }}
                  >
                    {preset.label}
                  </Button>
                )
              })}
              {sizes.length > 0 && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setSizes([])}>
                  초기화
                </Button>
              )}
            </div>
          </div>

          {/* Individual size toggles */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">개별 사이즈 토글</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_SIZE_ORDER.filter((v, i, arr) => arr.indexOf(v) === i).map((name) => {
                const selected = sizes.some((s) => s.name === name)
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleSize(name)}
                    className={`rounded border px-3 py-1 text-sm transition-colors ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input hover:bg-muted"
                    }`}
                  >
                    {name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Custom size input */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">직접 입력:</span>
            <Input
              placeholder="예) FREE, OS"
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomSize() } }}
              className="w-28"
            />
            <Button type="button" variant="outline" size="sm" onClick={addCustomSize}>
              <Plus className="mr-1 h-3 w-3" /> 추가
            </Button>
          </div>

          {/* Custom sizes (not in predefined list) */}
          {sizes.filter((s) => !ALL_SIZE_ORDER.includes(s.name)).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sizes.filter((s) => !ALL_SIZE_ORDER.includes(s.name)).map((size) => (
                <div key={size.name} className="flex items-center gap-1 rounded border border-primary bg-primary/5 px-2 py-1 text-sm">
                  {size.name}
                  <button type="button" onClick={() => removeCustomSize(size.name)} className="ml-1">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Selected summary */}
          {sizes.length > 0 && (
            <p className="text-xs text-muted-foreground">
              선택된 사이즈: {sizes.map((s) => s.name).join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Size Spec (optional) */}
      <Card>
        <CardHeader>
          <CardTitle>{t("sizeSpecOptional")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={sizeSpec}
            onChange={(e) => setSizeSpec(e.target.value)}
            rows={4}
            placeholder={t("sizeSpecHint")}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t("sizeSpecTextHint")}
          </p>
        </CardContent>
      </Card>

      {/* Price & Stock Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>{t("priceStockMatrix")} ({priceCurrency})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-3">
            <Label>{t("basePrice")} ({priceCurrency})</Label>
            <Input
              type="number"
              step={priceCurrency === "KRW" || priceCurrency === "JPY" ? "1" : "0.01"}
              value={defaultPrice || ""}
              onChange={(e) => setDefaultPrice(parseFloat(e.target.value) || 0)}
              className="w-32"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const next: Record<string, number> = {}
                for (const c of colors) {
                  for (const s of sizes) {
                    if (c.name && s.name) next[`${c.name}-${s.name}`] = defaultPrice
                  }
                }
                setVariantPrices(next)
              }}
            >
              {t("applyAll")}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-1 text-left">{t("colorSizeHeader")}</th>
                  {sizes.filter((s) => s.name).map((size, i) => (
                    <th key={i} className="px-2 py-1 text-center">{size.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {colors.filter((c) => c.name).map((color, ci) => (
                  <tr key={ci} className="border-b">
                    <td className="px-2 py-2 font-medium">{color.name}</td>
                    {sizes.filter((s) => s.name).map((size, si) => (
                      <td key={si} className="px-2 py-2">
                        <div className="flex flex-col gap-1">
                          <Input
                            type="number"
                            step={priceCurrency === "KRW" || priceCurrency === "JPY" ? "1" : "0.01"}
                            placeholder={t("price")}
                            value={getVariantPrice(color.name, size.name) || ""}
                            onChange={(e) => {
                              setVariantPrices((prev) => ({
                                ...prev,
                                [`${color.name}-${size.name}`]: parseFloat(e.target.value) || 0,
                              }))
                            }}
                            className="h-8 w-24 text-xs"
                          />
                          <Input
                            type="number"
                            placeholder={t("stock")}
                            value={getVariantStock(color.name, size.name) || ""}
                            onChange={(e) => {
                              setVariantStocks((prev) => ({
                                ...prev,
                                [`${color.name}-${size.name}`]: parseInt(e.target.value) || 0,
                              }))
                            }}
                            className="h-8 w-24 text-xs"
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* MOQ Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("moqSettings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("productMoq")}</Label>
              <Input
                type="number"
                min={0}
                value={moq || ""}
                onChange={(e) => setMoq(parseInt(e.target.value) || 0)}
                placeholder="0"
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">{t("productMoqHint")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("colorMoq")}</Label>
              <Input
                type="number"
                min={0}
                value={colorMoq || ""}
                onChange={(e) => setColorMoq(parseInt(e.target.value) || 0)}
                placeholder="0"
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">{t("colorMoqHint")}</p>
            </div>
          </div>
          {colors.some((c) => c.name.trim()) && (
            <div className="space-y-2">
              <Label>{t("colorMoqOverride")}</Label>
              <p className="text-xs text-muted-foreground">{t("colorMoqOverrideHint")}</p>
              <div className="space-y-2">
                {colors.filter((c) => c.name.trim()).map((color, i) => {
                  const originalIndex = colors.indexOf(color)
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span
                        className="inline-block h-4 w-4 rounded-full border"
                        style={{ backgroundColor: color.hexColor || "#ccc" }}
                      />
                      <span className="w-24 text-sm">{color.name}</span>
                      <Input
                        type="number"
                        min={0}
                        value={color.moq || ""}
                        onChange={(e) => {
                          const next = [...colors]
                          next[originalIndex].moq = parseInt(e.target.value) || 0
                          setColors(next)
                        }}
                        placeholder="0"
                        className="h-8 w-24 text-sm"
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? tc("saving") : isEdit ? t("editProduct") : t("addProduct")}
        </Button>
      </div>
    </form>
  )
}
