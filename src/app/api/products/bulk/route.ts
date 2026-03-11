import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"
import { ADULT_SIZES, KIDS_NUM_SIZES, KIDS_LETTER_SIZES, ALL_SIZES } from "@/lib/product-sizes"

interface FailedRow {
  row: number
  error: string
}

type ProductGroups = Map<string, {
  code: string
  category: string
  description: string
  material: string
  priceCurrency: string
  variants: { colorName: string; colorCode: string; hexColor: string; sizeName: string; price: number; stock: number }[]
}>

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
}

// 새 형식: "사이즈*" 컬럼에 쉼표 구분 사이즈 문자열 (예: "XS,S,M,L,XL" 또는 "80,85,90")
function parseSheetNew(
  rows: Record<string, any>[],
  sheetLabel: string,
  failed: FailedRow[],
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
    const sizeStr = String(row["사이즈*"] ?? "").trim()
    const stock = Number(row["재고"] ?? 0) || 0

    if (!name) { failed.push({ row: rowNum, error: `[${sheetLabel}] 상품명이 비어있습니다.` }); continue }
    if (!category) { failed.push({ row: rowNum, error: `[${sheetLabel}] 카테고리가 비어있습니다.` }); continue }
    if (!colorName) { failed.push({ row: rowNum, error: `[${sheetLabel}] 컬러명이 비어있습니다.` }); continue }
    if (isNaN(price) || price <= 0) { failed.push({ row: rowNum, error: `[${sheetLabel}] 가격이 올바르지 않습니다.` }); continue }

    const sizeNames = sizeStr.split(",").map((s) => s.trim()).filter(Boolean)
    if (sizeNames.length === 0) {
      failed.push({ row: rowNum, error: `[${sheetLabel}] 사이즈가 비어있습니다. (예: XS,S,M,L,XL 또는 80,85,90)` })
      continue
    }

    const description = String(row["설명"] ?? "").trim()
    const material = String(row["혼용률"] ?? "").trim()
    const colorCode = String(row["컬러코드"] ?? "").trim()
    const rawHex = String(row["컬러값(HEX)"] ?? "").trim()
    const hexColor = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(rawHex) ? rawHex : ""
    const priceCurrency = String(row["통화"] ?? "KRW").trim().toUpperCase()

    if (!groups.has(name)) {
      groups.set(name, { code, category, description, material, priceCurrency, variants: [] })
    }

    const group = groups.get(name)!
    if (description && !group.description) group.description = description
    if (material && !group.material) group.material = material

    for (const sizeName of sizeNames) {
      group.variants.push({ colorName, colorCode, hexColor, sizeName, price, stock })
    }
  }
}

// 사이즈별 컬럼 형식: 각 사이즈가 별도 컬럼 (사이즈 컬럼 값 = 재고 수량)
function parseSheetSizeColumns(
  rows: Record<string, any>[],
  sizeColumns: readonly string[],
  sheetLabel: string,
  failed: FailedRow[],
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
      if (isNaN(stock) || stock <= 0) continue
      sizeVariants.push({ sizeName, stock })
    }

    if (sizeVariants.length === 0) {
      failed.push({ row: rowNum, error: `[${sheetLabel}] 사이즈 재고가 입력되지 않았습니다.` })
      continue
    }

    const description = String(row["설명"] ?? "").trim()
    const material = String(row["혼용률"] ?? "").trim()
    const colorCode = String(row["컬러코드"] ?? "").trim()
    const rawHex = String(row["컬러값(HEX)"] ?? "").trim()
    const hexColor = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(rawHex) ? rawHex : ""
    const priceCurrency = String(row["통화"] ?? "KRW").trim().toUpperCase()

    if (!groups.has(name)) {
      groups.set(name, { code, category, description, material, priceCurrency, variants: [] })
    }

    const group = groups.get(name)!
    if (description && !group.description) group.description = description
    if (material && !group.material) group.material = material

    for (const { sizeName, stock } of sizeVariants) {
      group.variants.push({ colorName, colorCode, hexColor, sizeName, price, stock })
    }
  }
}

// 시트명으로 사이즈 컬럼 결정
function getSizeColumnsForSheet(sheetName: string): readonly string[] {
  const lower = sheetName.toLowerCase()
  if (lower.includes("숫자")) return KIDS_NUM_SIZES
  if (lower.includes("영어")) return KIDS_LETTER_SIZES
  if (lower.includes("아동")) return [...KIDS_NUM_SIZES, ...KIDS_LETTER_SIZES]
  return ADULT_SIZES
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

    const sheetsToProcess = wb.SheetNames.length > 0 ? wb.SheetNames : []

    for (const sheetName of sheetsToProcess) {
      const ws = wb.Sheets[sheetName]
      if (!ws) continue
      const rows = XLSX.utils.sheet_to_json(ws) as Record<string, any>[]
      if (rows.length === 0) continue

      // 첫 행의 키를 보고 형식 판단
      const firstRow = rows[0]
      if ("사이즈*" in firstRow) {
        // 구 형식: "사이즈*" 컬럼에 쉼표 구분 사이즈
        parseSheetNew(rows, sheetName, failed, productGroups)
      } else {
        // 새 형식: 사이즈별 컬럼 (사이즈명 = 컬럼 헤더, 값 = 재고 수량)
        const sizeColumns = getSizeColumnsForSheet(sheetName)
        parseSheetSizeColumns(rows, sizeColumns, sheetName, failed, productGroups)
      }
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
    const sizeOrder = ALL_SIZES

    for (const [productName, group] of productGroups) {
      try {
        const categoryId = categoryMap.get(group.category)
        if (!categoryId) { failed.push({ row: 0, error: `카테고리 "${group.category}" 처리 실패` }); continue }

        const colorsMap = new Map<string, { colorCode: string; hexColor: string }>()
        const sizesSet = new Set<string>()

        for (const v of group.variants) {
          if (!colorsMap.has(v.colorName)) colorsMap.set(v.colorName, { colorCode: v.colorCode, hexColor: v.hexColor })
          sizesSet.add(v.sizeName)
        }

        const colors = [...colorsMap.entries()].map(([name, { colorCode, hexColor }], i) => ({
          name, colorCode: colorCode || undefined, hexColor: hexColor || undefined, images: [] as string[], sortOrder: i,
        }))

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
            priceCurrency: group.priceCurrency || "KRW",
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
