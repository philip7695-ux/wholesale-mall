import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"
import { ADULT_SIZES, KIDS_NUM_SIZES, KIDS_LETTER_SIZES, ALL_SIZES, determineAgeGroup, normalizeAgeGroup, type AgeGroupValue, isSizeColumn} from "@/lib/product-sizes"
import { seasonKeyFromCode } from "@/lib/season"

// 대량 생성은 DB 왕복이 많아 오래 걸린다. 청크로 나눠 보내더라도 여유를 둔다.
export const maxDuration = 60

interface FailedRow {
  row: number
  error: string
}

type ProductGroups = Map<string, {
  code: string
  name: string
  ageGroup: AgeGroupValue | null
  category: string
  description: string
  material: string
  origin: string
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
    const origin = String(row["원산지"] ?? "").trim()
    const colorCode = String(row["컬러코드"] ?? "").trim()
    const rawHex = String(row["컬러값(HEX)"] ?? "").trim()
    const hexColor = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(rawHex) ? rawHex : ""
    const priceCurrency = String(row["통화"] ?? "KRW").trim().toUpperCase()

    // 그룹 키는 상품코드 우선(동일 상품명의 다른 스타일이 합쳐지는 것 방지)
    const groupKey = code || `name:${name}`
    const ageGroup = normalizeAgeGroup(String(row["연령대"] ?? ""))

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { code, name, ageGroup, category, description, material, origin, priceCurrency, variants: [] })
    }

    const group = groups.get(groupKey)!
    if (description && !group.description) group.description = description
    if (material && !group.material) group.material = material
    if (origin && !group.origin) group.origin = origin
    if (ageGroup && !group.ageGroup) group.ageGroup = ageGroup

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
      // 재고 0도 사이즈를 생성한다(품절로 노출). 빈 셀만 "사이즈 없음"으로 처리.
      if (isNaN(stock) || stock < 0) continue
      sizeVariants.push({ sizeName, stock })
    }

    if (sizeVariants.length === 0) {
      failed.push({ row: rowNum, error: `[${sheetLabel}] 사이즈가 하나도 입력되지 않았습니다.` })
      continue
    }

    const description = String(row["설명"] ?? "").trim()
    const material = String(row["혼용률"] ?? "").trim()
    const origin = String(row["원산지"] ?? "").trim()
    const colorCode = String(row["컬러코드"] ?? "").trim()
    const rawHex = String(row["컬러값(HEX)"] ?? "").trim()
    const hexColor = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(rawHex) ? rawHex : ""
    const priceCurrency = String(row["통화"] ?? "KRW").trim().toUpperCase()

    // 그룹 키는 상품코드 우선(동일 상품명의 다른 스타일이 합쳐지는 것 방지)
    const groupKey = code || `name:${name}`
    const ageGroup = normalizeAgeGroup(String(row["연령대"] ?? ""))

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { code, name, ageGroup, category, description, material, origin, priceCurrency, variants: [] })
    }

    const group = groups.get(groupKey)!
    if (description && !group.description) group.description = description
    if (material && !group.material) group.material = material
    if (origin && !group.origin) group.origin = origin
    if (ageGroup && !group.ageGroup) group.ageGroup = ageGroup

    for (const { sizeName, stock } of sizeVariants) {
      group.variants.push({ colorName, colorCode, hexColor, sizeName, price, stock })
    }
  }
}

// 행 배열의 형식을 보고 알맞은 파서로 위임
function parseSheet(
  rows: Record<string, any>[],
  sheetName: string,
  failed: FailedRow[],
  groups: ProductGroups,
) {
  if (rows.length === 0) return
  if ("사이즈*" in rows[0]) {
    parseSheetNew(rows, sheetName, failed, groups)
  } else {
    // 헤더에서 사이즈 열을 직접 찾는다. 시트 이름(성인/아동)에 기대지 않으므로
    // 한 시트에 여러 사이즈 체계를 섞어 올려도 된다. 헤더에 사이즈 열이
    // 하나도 없으면 예전처럼 시트 이름으로 유추한다(옛 파일 호환).
    const detected = Object.keys(rows[0]).filter(isSizeColumn)
    const sizeCols = detected.length > 0 ? detected : getSizeColumnsForSheet(sheetName)
    parseSheetSizeColumns(rows, sizeCols, sheetName, failed, groups)
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
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const failed: FailedRow[] = []
    const productGroups: ProductGroups = new Map()
    const contentType = request.headers.get("content-type") ?? ""

    if (contentType.includes("application/json")) {
      // 청크 업로드: 클라이언트가 엑셀을 파싱해 행 묶음을 나눠 보낸다
      const body = await request.json()
      const rows: Record<string, any>[] = Array.isArray(body?.rows) ? body.rows : []
      const sheetName: string = String(body?.sheetName ?? "")
      if (rows.length === 0) {
        return NextResponse.json({ error: "처리할 행이 없습니다." }, { status: 400 })
      }
      parseSheet(rows, sheetName, failed, productGroups)
    } else {
      // 파일 업로드(기존 방식): 서버에서 엑셀 전체를 파싱한다
      const formData = await request.formData()
      const file = formData.get("file") as File | null
      if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 })

      const buffer = Buffer.from(await file.arrayBuffer())
      const wb = XLSX.read(buffer, { type: "buffer" })

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName]
        if (!ws) continue
        const rows = XLSX.utils.sheet_to_json(ws) as Record<string, any>[]
        parseSheet(rows, sheetName, failed, productGroups)
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

    // 상품 생성/갱신
    let created = 0
    let updated = 0
    const sizeOrder = ALL_SIZES

    for (const [groupKey, group] of productGroups) {
      const productName = group.name
      try {
        const categoryId = categoryMap.get(group.category)
        if (!categoryId) { failed.push({ row: 0, error: `카테고리 "${group.category}" 처리 실패` }); continue }

        const colorsMap = new Map<string, { colorCode: string; hexColor: string }>()
        const sizesSet = new Set<string>()

        for (const v of group.variants) {
          if (!colorsMap.has(v.colorName)) colorsMap.set(v.colorName, { colorCode: v.colorCode, hexColor: v.hexColor })
          sizesSet.add(v.sizeName)
        }

        const sortedSizes = [...sizesSet].sort((a, b) => {
          const ai = sizeOrder.indexOf(a)
          const bi = sizeOrder.indexOf(b)
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
        })
        const ageGroup = group.ageGroup ?? determineAgeGroup(productName, sortedSizes)

        // 같은 상품코드가 이미 있으면 덮어쓴다(재업로드 대비).
        // 단, 변형을 지우면 장바구니가 Cascade 로 함께 삭제되므로 삭제 없이 갱신한다.
        const existing = group.code
          ? await prisma.product.findUnique({
              where: { code: group.code },
              include: { colors: true, sizes: true },
            })
          : null

        if (!existing) {
          const colors = [...colorsMap.entries()].map(([name, { colorCode, hexColor }], i) => ({
            name, colorCode: colorCode || undefined, hexColor: hexColor || undefined, images: [] as string[], sortOrder: i,
          }))
          const sizes = sortedSizes.map((name, i) => ({ name, sortOrder: i }))

          const product = await prisma.product.create({
            data: {
              name: productName,
              code: group.code || null,
              seasonKey: seasonKeyFromCode(group.code),
              description: group.description || null,
              material: group.material || null,
              origin: group.origin || null,
              categoryId,
              images: [],
              isActive: true,
              priceCurrency: group.priceCurrency || "KRW",
              ageGroup,
              colors: { create: colors },
              sizes: { create: sizes },
            },
            include: { colors: true, sizes: true },
          })

          const colorIdMap = new Map(product.colors.map((c: any) => [c.name, c.id]))
          const sizeIdMap = new Map(product.sizes.map((sz: any) => [sz.name, sz.id]))

          const variantData = group.variants
            .map((v) => {
              const colorId = colorIdMap.get(v.colorName)
              const sizeId = sizeIdMap.get(v.sizeName)
              if (!colorId || !sizeId) return null
              return { productId: product.id, colorId, sizeId, price: v.price, stock: v.stock }
            })
            .filter(Boolean) as { productId: string; colorId: string; sizeId: string; price: number; stock: number }[]

          if (variantData.length > 0) await prisma.productVariant.createMany({ data: variantData })
          created++
        } else {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              name: productName,
              description: group.description || null,
              material: group.material || null,
              origin: group.origin || null,
              categoryId,
              priceCurrency: group.priceCurrency || "KRW",
              ageGroup,
            },
          })

          const colorIdMap = new Map(existing.colors.map((c: any) => [c.name, c.id]))
          let colorOrder = existing.colors.length
          for (const [name, { colorCode, hexColor }] of colorsMap) {
            if (colorIdMap.has(name)) continue
            const c = await prisma.productColor.create({
              data: {
                productId: existing.id, name,
                colorCode: colorCode || undefined, hexColor: hexColor || undefined,
                images: [], sortOrder: colorOrder++,
              },
            })
            colorIdMap.set(name, c.id)
          }

          const sizeIdMap = new Map(existing.sizes.map((sz: any) => [sz.name, sz.id]))
          let sizeOrderIdx = existing.sizes.length
          for (const name of sortedSizes) {
            if (sizeIdMap.has(name)) continue
            const sz = await prisma.productSize.create({
              data: { productId: existing.id, name, sortOrder: sizeOrderIdx++ },
            })
            sizeIdMap.set(name, sz.id)
          }

          for (const v of group.variants) {
            const colorId = colorIdMap.get(v.colorName)
            const sizeId = sizeIdMap.get(v.sizeName)
            if (!colorId || !sizeId) continue
            await prisma.productVariant.upsert({
              where: { productId_colorId_sizeId: { productId: existing.id, colorId, sizeId } },
              // 기존 변형의 재고는 건드리지 않는다. 재고는 별도로 관리되며
              // 재업로드로 덮어쓰면 운영 중 입력한 수량이 사라진다.
              update: { price: v.price },
              create: { productId: existing.id, colorId, sizeId, price: v.price, stock: v.stock },
            })
          }
          updated++
        }
      } catch (err: any) {
        failed.push({ row: 0, error: `상품 "${group.name}" (${groupKey}) 처리 실패: ${err.message}` })
      }
    }

    return NextResponse.json({ success: created + updated, created, updated, failed })
  } catch (error: any) {
    console.error("Bulk upload error:", error)
    // 관리자 전용 엔드포인트이므로 원인을 그대로 돌려준다.
    // 메시지를 감추면 대량등록 실패를 화면만 보고 진단할 수 없다.
    const detail = [error?.code, error?.message].filter(Boolean).join(" ")
    return NextResponse.json(
      { error: `엑셀 업로드 처리 중 오류가 발생했습니다. ${detail}`.trim() },
      { status: 500 },
    )
  }
}
