"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, X, Upload } from "lucide-react"
import { toast } from "sonner"

interface Category {
  id: string
  name: string
  slug: string
}

interface ColorInput {
  name: string
  colorCode: string
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
    colors: { name: string; colorCode: string | null; images: string[] }[]
    sizes: { name: string }[]
    variants: { color: { name: string }; size: { name: string }; price: number; stock: number }[]
  }
}

export function ProductForm({ categories, initialData }: ProductFormProps) {
  const router = useRouter()
  const isEdit = !!initialData

  const [code, setCode] = useState(initialData?.code || "")
  const [name, setName] = useState(initialData?.name || "")
  const [description, setDescription] = useState(initialData?.description || "")
  const [categoryId, setCategoryId] = useState(initialData?.categoryId || "")
  const [images, setImages] = useState<string[]>(initialData?.images || [])
  const [material, setMaterial] = useState(initialData?.material || "")
  const [sizeSpec, setSizeSpec] = useState(initialData?.sizeSpec || "")
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true)
  const [colors, setColors] = useState<ColorInput[]>(
    initialData?.colors.map((c) => ({
      name: c.name,
      colorCode: c.colorCode || "",
    })) || [{ name: "", colorCode: "" }],
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
        toast.error(`${file.name} 업로드 실패`)
      }
    }
    e.target.value = ""
    setUploading(false)
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  function addColor() {
    setColors([...colors, { name: "", colorCode: "" }])
  }

  function removeColor(index: number) {
    setColors(colors.filter((_, i) => i !== index))
  }

  function addSize() {
    setSizes([...sizes, { name: "" }])
  }

  function removeSize(index: number) {
    setSizes(sizes.filter((_, i) => i !== index))
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
      toast.error("상품명과 카테고리를 입력해주세요.")
      return
    }

    const validColors = colors.filter((c) => c.name.trim())
    const validSizes = sizes.filter((s) => s.name.trim())

    if (validColors.length === 0 || validSizes.length === 0) {
      toast.error("최소 1개의 컬러와 사이즈를 입력해주세요.")
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
        colors: validColors.map((c) => ({ ...c, images: [] })),
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

      toast.success(isEdit ? "상품이 수정되었습니다." : "상품이 등록되었습니다.")
      router.push("/admin/products")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류가 발생했습니다.")
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>기본 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>상품코드</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="예: ST001" />
            </div>
            <div className="space-y-2">
              <Label>상품명 *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>카테고리 *</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>상품 설명</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>혼용률</Label>
            <Input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="예: 면 100%, 폴리에스터 80% 면 20%" />
          </div>

          {/* 상품 이미지 (여러장) */}
          <div className="space-y-2">
            <Label>상품 이미지 (첫번째 사진이 대표 이미지)</Label>
            <div className="flex flex-wrap gap-3">
              {images.map((img, i) => (
                <div key={i} className="relative">
                  <img src={img} alt="" className="h-20 w-20 rounded-md object-cover border" />
                  {i === 0 && (
                    <span className="absolute -top-1.5 -left-1.5 rounded bg-primary px-1 text-[10px] text-primary-foreground">
                      대표
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
                  {uploading ? "업로드중" : "추가"}
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
              <p className="text-xs text-muted-foreground">{images.length}장 업로드됨</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <Label htmlFor="isActive">판매 활성</Label>
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>컬러</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addColor}>
            <Plus className="mr-1 h-3 w-3" /> 컬러 추가
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {colors.map((color, i) => (
            <div key={i} className="flex items-center gap-3">
              <Input
                placeholder="컬러명 (예: 블랙)"
                value={color.name}
                onChange={(e) => {
                  const next = [...colors]
                  next[i].name = e.target.value
                  setColors(next)
                }}
                className="flex-1"
              />
              <Input
                type="color"
                value={color.colorCode || "#000000"}
                onChange={(e) => {
                  const next = [...colors]
                  next[i].colorCode = e.target.value
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>사이즈</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addSize}>
            <Plus className="mr-1 h-3 w-3" /> 사이즈 추가
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {sizes.map((size, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input
                  placeholder="예: FREE, S, M"
                  value={size.name}
                  onChange={(e) => {
                    const next = [...sizes]
                    next[i].name = e.target.value
                    setSizes(next)
                  }}
                  className="w-24"
                />
                {sizes.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeSize(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Size Spec (optional) */}
      <Card>
        <CardHeader>
          <CardTitle>사이즈 스펙 (선택사항)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={sizeSpec}
            onChange={(e) => setSizeSpec(e.target.value)}
            rows={4}
            placeholder={`예시 (JSON 형식):
{"headers":["사이즈","총장","어깨","가슴","소매"],"rows":[{"사이즈":"S","총장":"65","어깨":"42","가슴":"96","소매":"58"},{"사이즈":"M","총장":"67","어깨":"44","가슴":"100","소매":"60"}]}

또는 일반 텍스트로 입력해도 됩니다.`}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            JSON 형식으로 입력하면 테이블로 표시됩니다. 일반 텍스트도 가능합니다.
          </p>
        </CardContent>
      </Card>

      {/* Price & Stock Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>가격 / 재고 매트릭스</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center gap-3">
            <Label>기본 가격 (원)</Label>
            <Input
              type="number"
              value={defaultPrice}
              onChange={(e) => setDefaultPrice(parseInt(e.target.value) || 0)}
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
              전체 적용
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-1 text-left">컬러 \ 사이즈</th>
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
                            placeholder="가격"
                            value={getVariantPrice(color.name, size.name) || ""}
                            onChange={(e) => {
                              setVariantPrices((prev) => ({
                                ...prev,
                                [`${color.name}-${size.name}`]: parseInt(e.target.value) || 0,
                              }))
                            }}
                            className="h-8 w-24 text-xs"
                          />
                          <Input
                            type="number"
                            placeholder="재고"
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

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          취소
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "저장중..." : isEdit ? "상품 수정" : "상품 등록"}
        </Button>
      </div>
    </form>
  )
}
