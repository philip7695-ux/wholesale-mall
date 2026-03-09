import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getApiTranslations } from "@/lib/api-i18n"
import * as XLSX from "xlsx"
import { ADULT_SIZES, KIDS_SIZES } from "@/lib/product-sizes"

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

// Column header aliases for multi-language support
const HEADER_ALIASES: Record<string, string[]> = {
  code: ["상품코드", "Product Code", "商品编码", "商品コード"],
  name: ["상품명*", "Product Name*", "商品名*"],
  category: ["카테고리*", "Category*", "分类*", "カテゴリ*"],
  color: ["컬러명*", "Color*", "颜色名*", "カラー名*"],
  price: ["가격*", "Price*", "价格*", "価格*"],
  size: ["사이즈*", "Size*", "尺码*", "サイズ*"],
  stock: ["재고", "Stock", "库存", "在庫"],
  desc: ["설명", "Description", "说明", "説明"],
  material: ["혼용률", "Composition", "成分", "混用率"],
  colorCode: ["컬러코드", "Color Code", "颜色代码", "カラーコード"],
}

function getVal(row: Record<string, any>, field: string): any {
  const aliases = HEADER_ALIASES[field]
  if (!aliases) return undefined
  for (const alias of aliases) {
    if (alias in row) return row[alias]
  }
  return undefined
}

function hasSizeColumn(row: Record<string, any>): boolean {
  const sizeAliases = HEADER_ALIASES.size
  return sizeAliases.some((alias) => alias in row)
}

function parseSheetNew(
  rows: Record<string, any>[],
  sheetLabel: string,
  failed: FailedRow[],
  groups: ProductGroups,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2

    const code = String(getVal(row, "code") ?? "").trim()
    const name = String(getVal(row, "name") ?? "").trim()
    const category = String(getVal(row, "category") ?? "").trim()
    const colorName = String(getVal(row, "color") ?? "").trim()
    const price = Number(getVal(row, "price"))
    const sizeStr = String(getVal(row, "size") ?? "").trim()
    const stock = Number(getVal(row, "stock") ?? 0) || 0

    if (!name) { failed.push({ row: rowNum, error: `[${sheetLabel}] ${t("bulkNameRequired")}` }); continue }
    if (!category) { failed.push({ row: rowNum, error: `[${sheetLabel}] ${t("bulkCategoryRequired")}` }); continue }
    if (!colorName) { failed.push({ row: rowNum, error: `[${sheetLabel}] ${t("bulkColorRequired")}` }); continue }
    if (isNaN(price) || price <= 0) { failed.push({ row: rowNum, error: `[${sheetLabel}] ${t("bulkPriceRequired")}` }); continue }

    const sizeNames = sizeStr.split(",").map((s) => s.trim()).filter(Boolean)
    if (sizeNames.length === 0) {
      failed.push({ row: rowNum, error: `[${sheetLabel}] ${t("bulkSizeRequired")}` })
      continue
    }

    const description = String(getVal(row, "desc") ?? "").trim()
    const material = String(getVal(row, "material") ?? "").trim()
    const rawColorCode = String(getVal(row, "colorCode") ?? "").trim()
    const colorCode = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(rawColorCode) ? rawColorCode : ""

    if (!groups.has(name)) {
      groups.set(name, { code, category, description, material, variants: [] })
    }

    const group = groups.get(name)!
    if (description && !group.description) group.description = description
    if (material && !group.material) group.material = material

    for (const sizeName of sizeNames) {
      group.variants.push({ colorName, colorCode, sizeName, price, stock })
    }
  }
}

function parseSheetLegacy(
  rows: Record<string, any>[],
  sizeColumns: readonly string[],
  sheetLabel: string,
  failed: FailedRow[],
  groups: ProductGroups,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2

    const code = String(getVal(row, "code") ?? "").trim()
    const name = String(getVal(row, "name") ?? "").trim()
    const category = String(getVal(row, "category") ?? "").trim()
    const colorName = String(getVal(row, "color") ?? "").trim()
    const price = Number(getVal(row, "price"))

    if (!name) { failed.push({ row: rowNum, error: `[${sheetLabel}] ${t("bulkNameRequired")}` }); continue }
    if (!category) { failed.push({ row: rowNum, error: `[${sheetLabel}] ${t("bulkCategoryRequired")}` }); continue }
    if (!colorName) { failed.push({ row: rowNum, error: `[${sheetLabel}] ${t("bulkColorRequired")}` }); continue }
    if (isNaN(price) || price <= 0) { failed.push({ row: rowNum, error: `[${sheetLabel}] ${t("bulkPriceRequired")}` }); continue }

    const sizeVariants: { sizeName: string; stock: number }[] = []
    for (const sizeName of sizeColumns) {
      const val = row[sizeName]
      if (val === undefined || val === null || val === "") continue
      const stock = Number(val)
      sizeVariants.push({ sizeName, stock: isNaN(stock) ? 0 : stock })
    }

    if (sizeVariants.length === 0) {
      failed.push({ row: rowNum, error: `[${sheetLabel}] ${t("bulkSizeRequired")}` })
      continue
    }

    const description = String(getVal(row, "desc") ?? "").trim()
    const material = String(getVal(row, "material") ?? "").trim()
    const rawColorCode = String(getVal(row, "colorCode") ?? "").trim()
    const colorCode = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(rawColorCode) ? rawColorCode : ""

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

// Known kids sheet names across languages
const KIDS_SHEET_NAMES = ["아동복", "商品登録_子供", "商品登录_童装", "Products_Kids"]

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const t = await getApiTranslations(request, "api")

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: t("noFile") }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: "buffer" })

    const failed: FailedRow[] = []
    const productGroups: ProductGroups = new Map()

    const sheetsToProcess = wb.SheetNames.length > 0 ? wb.SheetNames : []

    for (const sheetName of sheetsToProcess) {
      const ws = wb.Sheets[sheetName]
      if (!ws) continue
      const rows = XLSX.utils.sheet_to_json(ws) as Record<string, any>[]
      if (rows.length === 0) continue

      const firstRow = rows[0]
      if (hasSizeColumn(firstRow)) {
        parseSheetNew(rows, sheetName, failed, productGroups, t)
      } else {
        const sizeColumns = KIDS_SHEET_NAMES.includes(sheetName) ? KIDS_SIZES : ADULT_SIZES
        parseSheetLegacy(rows, sizeColumns, sheetName, failed, productGroups, t)
      }
    }

    if (productGroups.size === 0 && failed.length === 0) {
      return NextResponse.json({ error: t("noFile") }, { status: 400 })
    }

    const categoryNames = [...new Set([...productGroups.values()].map((g) => g.category))]
    const categoryMap = new Map<string, string>()

    for (const catName of categoryNames) {
      const slug = toSlug(catName)
      let category = await prisma.category.findFirst({ where: { OR: [{ name: catName }, { slug }] } })
      if (!category) category = await prisma.category.create({ data: { name: catName, slug } })
      categoryMap.set(catName, category.id)
    }

    let success = 0
    const sizeOrder = [...ADULT_SIZES, ...KIDS_SIZES]

    for (const [productName, group] of productGroups) {
      try {
        const categoryId = categoryMap.get(group.category)
        if (!categoryId) { failed.push({ row: 0, error: t("bulkCategoryNotFound", { name: group.category }) }); continue }

        const colorsMap = new Map<string, string>()
        const sizesSet = new Set<string>()

        for (const v of group.variants) {
          if (!colorsMap.has(v.colorName)) colorsMap.set(v.colorName, v.colorCode)
          sizesSet.add(v.sizeName)
        }

        const colors = [...colorsMap.entries()].map(([name, colorCode], i) => ({
          name, colorCode: colorCode || undefined, images: [] as string[], sortOrder: i,
        }))

        const sizes = [...sizesSet]
          .sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b))
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
        failed.push({ row: 0, error: `${productName}: ${err.message}` })
      }
    }

    return NextResponse.json({ success, failed })
  } catch (error: any) {
    console.error("Bulk upload error:", error)
    return NextResponse.json({ error: t("uploadError") }, { status: 500 })
  }
}
