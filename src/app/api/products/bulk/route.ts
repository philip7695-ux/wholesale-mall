import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

const ADULT_SIZES = ["F", "S", "M", "L"]
const KIDS_SIZES = ["80", "85", "90", "100", "110", "120", "130", "140"]

interface FailedRow {
  row: number
  error: string
}

type ProductGroups = Map<string, {
  code: string
  category: string
  description: string
  material: string
  variants: { colorName: string; colorCode: string; sizeName: string; price: number; stock: number }[]
}>

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
}

function parseSheet(
  rows: Record<string, any>[],
  sizeColumns: string[],
  failed: FailedRow[],
  sheetLabel: string,
  groups: ProductGroups,
) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2

    const code = String(row["상품코드"] ?? "").trim()
    const name = String(row["상품명*"] ?? "").trim()
    const category = String(row["카테고리*"] ?? "").trim()
    const colorName = String(row["컬러명*"] ?? "").trim()
    const price = Number(row["가격*"])

    if (!name) { failed.push({ row: rowNum, error: `[${sheetLabel}] 상품명이 비어있습니다.` }); continue }
    if (!category) { failed.push({ row: rowNum, error: `[${sheetLabel}] 카테고리가 비어있습니다.` }); continue }
    if (!colorName) { failed.push({ row: rowNum, error: `[${sheetLabel}] 컬러명이 비어있습니다.` }); continue }
    if (isNaN(price) || price <= 0) { failed.push({ row: rowNum, error: `[${sheetLabel}] 가격이 올바르지 않습니다.` }); continue }

    const sizeVariants: { sizeName: string; stock: number }[] = []
    for (const sizeName of sizeColumns) {
      const val = row[sizeName]
      if (val === undefined || val === null || val === "") continue
      const stock = Number(val)
      sizeVariants.push({ sizeName, stock: isNaN(stock) ? 0 : stock })
    }

    if (sizeVariants.length === 0) {
      failed.push({ row: rowNum, error: `[${sheetLabel}] 사이즈 재고가 입력되지 않았습니다.` })
      continue
    }

    const description = String(row["설명"] ?? "").trim()
    const material = String(row["혼용률"] ?? "").trim()
    const colorCode = String(row["컬러코드"] ?? "").trim()

    if (!groups.has(name)) {
      groups.set(name, { code, category, description, material, variants: [] })
    }

    const group = groups.get(name)!
    if (description && !group.description) group.description = description
    if (material && !group.material) group.material = material

    for (const { sizeName, stock } of sizeVariants) {
      group.variants.push({ colorName, colorCode, sizeName, price, stock })
    }
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: "buffer" })

    const failed: FailedRow[] = []
    const productGroups: ProductGroups = new Map()

    const adultWs = wb.Sheets["성인복"]
    const kidsWs = wb.Sheets["아동복"]

    if (adultWs) {
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(adultWs)
      parseSheet(rows, ADULT_SIZES, failed, "성인복", productGroups)
    }
    if (kidsWs) {
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(kidsWs)
      parseSheet(rows, KIDS_SIZES, failed, "아동복", productGroups)
    }

    // 시트 이름이 없는 경우 첫 번째 시트를 두 사이즈 합쳐서 파싱 (하위 호환)
    if (!adultWs && !kidsWs) {
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws)
      parseSheet(rows, [...ADULT_SIZES, ...KIDS_SIZES], failed, "시트1", productGroups)
    }

    if (productGroups.size === 0 && failed.length === 0) {
      return NextResponse.json({ error: "엑셀에 데이터가 없습니다." }, { status: 400 })
    }

    // 카테고리 처리
    const categoryNames = [...new Set([...productGroups.values()].map((g) => g.category))]
    const categoryMap = new Map<string, string>()

    for (const catName of categoryNames) {
      const slug = toSlug(catName)
      let category = await prisma.category.findFirst({ where: { OR: [{ name: catName }, { slug }] } })
      if (!category) category = await prisma.category.create({ data: { name: catName, slug } })
      categoryMap.set(catName, category.id)
    }

    // 상품 생성
    let success = 0

    for (const [productName, group] of productGroups) {
      try {
        const categoryId = categoryMap.get(group.category)
        if (!categoryId) { failed.push({ row: 0, error: `카테고리 "${group.category}" 처리 실패` }); continue }

        const colorsMap = new Map<string, string>()
        const sizesSet = new Set<string>()

        for (const v of group.variants) {
          if (!colorsMap.has(v.colorName)) colorsMap.set(v.colorName, v.colorCode)
          sizesSet.add(v.sizeName)
        }

        const colors = [...colorsMap.entries()].map(([name, colorCode], i) => ({
          name, colorCode: colorCode || undefined, images: [] as string[], sortOrder: i,
        }))

        // 사이즈 정렬 순서를 템플릿 순서 기준으로
        const sizeOrder = [...ADULT_SIZES, ...KIDS_SIZES]
        const sizes = [...sizesSet]
          .sort((a, b) => {
            const ai = sizeOrder.indexOf(a)
            const bi = sizeOrder.indexOf(b)
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
          })
          .map((name, i) => ({ name, sortOrder: i }))

        const product = await prisma.product.create({
          data: {
            name: productName,
            code: group.code || null,
            description: group.description || null,
            material: group.material || null,
            categoryId,
            images: [],
            isActive: true,
            colors: { create: colors },
            sizes: { create: sizes },
          },
          include: { colors: true, sizes: true },
        })

        const colorIdMap = new Map(product.colors.map((c: any) => [c.name, c.id]))
        const sizeIdMap = new Map(product.sizes.map((s: any) => [s.name, s.id]))

        const variantData = group.variants
          .map((v) => {
            const colorId = colorIdMap.get(v.colorName)
            const sizeId = sizeIdMap.get(v.sizeName)
            if (!colorId || !sizeId) return null
            return { productId: product.id, colorId, sizeId, price: v.price, stock: v.stock }
          })
          .filter(Boolean) as { productId: string; colorId: string; sizeId: string; price: number; stock: number }[]

        if (variantData.length > 0) await prisma.productVariant.createMany({ data: variantData })

        success++
      } catch (err: any) {
        failed.push({ row: 0, error: `상품 "${productName}" 생성 실패: ${err.message}` })
      }
    }

    return NextResponse.json({ success, failed })
  } catch (error: any) {
    console.error("Bulk upload error:", error)
    return NextResponse.json({ error: "엑셀 업로드 처리 중 오류가 발생했습니다." }, { status: 500 })
  }
}
