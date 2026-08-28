import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"
import { ADULT_SIZES, KIDS_NUM_SIZES, KIDS_LETTER_SIZES, sortSizeNames, determineAgeGroup, normalizeAgeGroup, type AgeGroupValue, isSizeColumn} from "@/lib/product-sizes"
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
  brand: string
  yearRaw: string
  seasonRaw: string
  description: string
  material: string
  origin: string
  priceCurrency: string
  variants: { colorName: string; colorCode: string; hexColor: string; sizeName: string; price: number; stock: number }[]
}>


/**
 * 명시된 연도·시즌 → seasonKey. 브랜드마다 품번 체계가 달라 코드 파싱에
 * 기대지 않고 템플릿의 연도/시즌 열을 우선한다. (2027|27|7 → "7", 시즌은
 * 1~4 또는 SS/SP/SU/FW/WI)
 */
function seasonKeyFromExplicit(yearRaw: string, seasonRaw: string): string | null {
  const y = parseInt(yearRaw)
  if (!Number.isFinite(y)) return null
  const d = y >= 2020 ? y - 2020 : y >= 20 ? y - 20 : y
  if (d < 3 || d > 9) return null
  const map: Record<string, string> = {
    "1": "1", "2": "2", "3": "3", "4": "4",
    SS: "1", SP: "1", SPRING: "1", "봄": "1",
    SU: "2", SUMMER: "2", "여름": "2",
    FW: "3", FALL: "3", AUTUMN: "3", "가을": "3",
    WI: "4", WINTER: "4", "겨울": "4",
  }
  const sd = map[seasonRaw.trim().toUpperCase()]
  return sd ? `${d}${sd}` : null
}


// ── 카테고리 자동 판독 ─────────────────────────────────────────────
// 작성자가 유효한 카테고리명을 모른 채(영/한 혼용) 올리는 일이 잦다.
// 1) 정확 매칭 → 2) 별칭 → 3) 상품명 키워드 판독 → 4) 실패 순으로 푼다.

/** 흔한 영어 표기 → 몰 카테고리명 */
const CATEGORY_ALIASES: Record<string, string> = {
  OUTER: "아우터", OUTERWEAR: "아우터",
  TOP: "상의", TOPS: "상의",
  BOTTOM: "하의", BOTTOMS: "하의", PANTS: "하의",
  ONEPIECE: "원피스", "ONE-PIECE": "원피스", DRESS: "원피스",
  ACC: "액세서리", ACCESSORY: "액세서리", ACCESSORIES: "액세서리",
  SET: "세트",
  INNER: "이너웨어", INNERWEAR: "이너웨어", UNDERWEAR: "이너웨어",
  SWIM: "수영복", SWIMWEAR: "수영복",
  HAT: "모자", CAP: "모자",
  SOCKS: "양말",
  BAG: "가방",
}

/**
 * 상품명 키워드로 카테고리를 추정한다. 규칙 순서가 중요하다
 * (예: "sweater beanie" 는 모자가 스웨터보다 먼저 잡혀야 한다).
 * 규칙은 기존 4,500여 상품의 실제 분류 패턴에서 뽑았다.
 */
const NAME_RULES: [string[], string][] = [
  [["bonnet", "beanie", "beret", "ball cap", "camp cap", " cap", "sun hat", " hat", "ear muff"], "모자"],
  [["socks", "tights"], "양말"],
  [["backpack", " bag", "bag "], "가방"],
  [["bib", "hairpin", "hair band", "hairband", "goggles", "sunglass", "scrunchie", "hair clip"], "액세서리"],
  [["pajama", "underwear", "brief", "boxer", "sleepwear"], "이너웨어"],
  [["swimsuit", "swimwear", "swim suit", "rashguard", "rash guard"], "수영복"],
  [["bodysuit set", "loungewear set", "overall set", "loungewear"], "세트"],
  [["dress"], "원피스"],
  [["bodysuit", "overall", "romper", "onesie"], "올인원"],
  [["padding vest", "down vest", "jacket", "jumper", "windbreaker", "coat", "parka", "zip up", "zip-up"], "아우터"],
  [["sweatpants", "jogger", "leggings", "skirt", "shorts", "jeans", "denim pants", "pants"], "하의"],
  [["cardigan", "sweatshirt", "sweater", "pullover", "hoodie", "t-shirt", "tshirt", " tee", "blouse", "shirt", "vest", " top"], "상의"],
  [[" set"], "세트"],
]

function inferCategoryFromName(productName: string): string | null {
  const n = ` ${productName.toLowerCase()} `
  for (const [keys, cat] of NAME_RULES) {
    if (keys.some((k) => n.includes(k))) return cat
  }
  return null
}


/** "12,000" / "₩12000" / " 12000 " 도 숫자로 읽는다. */
function parsePrice(raw: unknown): number {
  if (typeof raw === "number") return raw
  const cleaned = String(raw ?? "").replace(/[,₩$\s원]/g, "")
  return cleaned === "" ? NaN : Number(cleaned)
}

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
  rowOffset = 0,
) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = rowOffset + i + 2

    const code = String(row["상품코드"] ?? "").trim()
    const name = String(row["상품명*"] ?? "").trim()
    const category = String(row["카테고리*"] ?? "").trim()
    const colorName = String(row["컬러명*"] ?? "").trim()
    let price = parsePrice(row["가격*"])
    const sizeStr = String(row["사이즈*"] ?? "").trim()
    const stock = Number(row["재고"] ?? 0) || 0

    if (!name) { failed.push({ row: rowNum, error: `[${sheetLabel}] 상품명이 비어있습니다.` }); continue }
    if (!colorName) { failed.push({ row: rowNum, error: `[${sheetLabel}] 컬러명이 비어있습니다.` }); continue }
    if (isNaN(price) || price <= 0) {
      // 세로형에서 이어지는 행은 가격을 비우기도 한다. 같은 상품(코드/이름)의
      // 같은 컬러 앞 행 가격을 물려받는다.
      const gk = (String(row["상품코드"] ?? "").trim()) || `name:${name}`
      const prev = groups.get(gk)?.variants.filter((v) => v.colorName === colorName).at(-1)
        ?? groups.get(gk)?.variants.at(-1)
      if (prev) price = prev.price
    }
    if (isNaN(price) || price <= 0) { failed.push({ row: rowNum, error: `[${sheetLabel}] 가격이 올바르지 않습니다. (숫자로 적어주세요. 예: 12000)` }); continue }

    const sizeNames = sizeStr.split(",").map((s) => s.trim()).filter(Boolean)
    if (sizeNames.length === 0) {
      failed.push({ row: rowNum, error: `[${sheetLabel}] 사이즈가 비어있습니다. (예: XS,S,M,L,XL 또는 80,85,90)` })
      continue
    }

    const material = String(row["혼용률"] ?? "").trim()
    const origin = String(row["원산지"] ?? "").trim()
    const colorCode = String(row["컬러코드"] ?? "").trim()
    const priceCurrency = String(row["통화"] ?? "KRW").trim().toUpperCase()
    const brand = String(row["브랜드"] ?? "").trim()
    const yearRaw = String(row["연도"] ?? "").trim()
    const seasonRaw = String(row["시즌"] ?? "").trim()

    // 그룹 키는 상품코드 우선(동일 상품명의 다른 스타일이 합쳐지는 것 방지)
    const groupKey = code || `name:${name}`
    const ageGroup = normalizeAgeGroup(String(row["연령대"] ?? ""))

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { code, name, ageGroup, category, brand, yearRaw, seasonRaw, description: "", material, origin, priceCurrency, variants: [] })
    }

    const group = groups.get(groupKey)!
    if (material && !group.material) group.material = material
    if (brand && !group.brand) group.brand = brand
    if (yearRaw && !group.yearRaw) group.yearRaw = yearRaw
    if (seasonRaw && !group.seasonRaw) group.seasonRaw = seasonRaw
    if (origin && !group.origin) group.origin = origin
    if (ageGroup && !group.ageGroup) group.ageGroup = ageGroup

    for (const sizeName of sizeNames) {
      group.variants.push({ colorName, colorCode, hexColor: "", sizeName, price, stock })
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
  rowOffset = 0,
) {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = rowOffset + i + 2

    const code = String(row["상품코드"] ?? "").trim()
    const name = String(row["상품명*"] ?? "").trim()
    const category = String(row["카테고리*"] ?? "").trim()
    const colorName = String(row["컬러명*"] ?? "").trim()
    let price = parsePrice(row["가격*"])

    if (!name) { failed.push({ row: rowNum, error: `[${sheetLabel}] 상품명이 비어있습니다.` }); continue }
    if (!colorName) { failed.push({ row: rowNum, error: `[${sheetLabel}] 컬러명이 비어있습니다.` }); continue }
    if (isNaN(price) || price <= 0) {
      // 세로형에서 이어지는 행은 가격을 비우기도 한다. 같은 상품(코드/이름)의
      // 같은 컬러 앞 행 가격을 물려받는다.
      const gk = (String(row["상품코드"] ?? "").trim()) || `name:${name}`
      const prev = groups.get(gk)?.variants.filter((v) => v.colorName === colorName).at(-1)
        ?? groups.get(gk)?.variants.at(-1)
      if (prev) price = prev.price
    }
    if (isNaN(price) || price <= 0) { failed.push({ row: rowNum, error: `[${sheetLabel}] 가격이 올바르지 않습니다. (숫자로 적어주세요. 예: 12000)` }); continue }

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

    const material = String(row["혼용률"] ?? "").trim()
    const origin = String(row["원산지"] ?? "").trim()
    const colorCode = String(row["컬러코드"] ?? "").trim()
    const priceCurrency = String(row["통화"] ?? "KRW").trim().toUpperCase()
    const brand = String(row["브랜드"] ?? "").trim()
    const yearRaw = String(row["연도"] ?? "").trim()
    const seasonRaw = String(row["시즌"] ?? "").trim()

    // 그룹 키는 상품코드 우선(동일 상품명의 다른 스타일이 합쳐지는 것 방지)
    const groupKey = code || `name:${name}`
    const ageGroup = normalizeAgeGroup(String(row["연령대"] ?? ""))

    if (!groups.has(groupKey)) {
      groups.set(groupKey, { code, name, ageGroup, category, brand, yearRaw, seasonRaw, description: "", material, origin, priceCurrency, variants: [] })
    }

    const group = groups.get(groupKey)!
    if (material && !group.material) group.material = material
    if (brand && !group.brand) group.brand = brand
    if (yearRaw && !group.yearRaw) group.yearRaw = yearRaw
    if (seasonRaw && !group.seasonRaw) group.seasonRaw = seasonRaw
    if (origin && !group.origin) group.origin = origin
    if (ageGroup && !group.ageGroup) group.ageGroup = ageGroup

    for (const { sizeName, stock } of sizeVariants) {
      group.variants.push({ colorName, colorCode, hexColor: "", sizeName, price, stock })
    }
  }
}

// 행 배열의 형식을 보고 알맞은 파서로 위임
function parseSheet(
  rows: Record<string, any>[],
  sheetName: string,
  failed: FailedRow[],
  groups: ProductGroups,
  rowOffset = 0,
) {
  if (rows.length === 0) return
  if ("사이즈*" in rows[0]) {
    parseSheetNew(rows, sheetName, failed, groups, rowOffset)
  } else {
    // 헤더에서 사이즈 열을 직접 찾는다. 시트 이름(성인/아동)에 기대지 않으므로
    // 한 시트에 여러 사이즈 체계를 섞어 올려도 된다. 헤더에 사이즈 열이
    // 하나도 없으면 예전처럼 시트 이름으로 유추한다(옛 파일 호환).
    const detected = Object.keys(rows[0]).filter(isSizeColumn)
    const sizeCols = detected.length > 0 ? detected : getSizeColumnsForSheet(sheetName)
    parseSheetSizeColumns(rows, sizeCols, sheetName, failed, groups, rowOffset)
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
    // 기본은 기존 카테고리에만 매칭. 새 카테고리 생성은 명시적으로 켠 경우만.
    let allowNewCategories = false

    if (contentType.includes("application/json")) {
      // 청크 업로드: 클라이언트가 엑셀을 파싱해 행 묶음을 나눠 보낸다
      const body = await request.json()
      const rows: Record<string, any>[] = Array.isArray(body?.rows) ? body.rows : []
      allowNewCategories = body?.allowNewCategories === true
      const rowOffset: number = Number(body?.rowOffset) || 0
      const sheetName: string = String(body?.sheetName ?? "")
      if (rows.length === 0) {
        return NextResponse.json({ error: "처리할 행이 없습니다." }, { status: 400 })
      }
      parseSheet(rows, sheetName, failed, productGroups, rowOffset)
    } else {
      // 파일 업로드(기존 방식): 서버에서 엑셀 전체를 파싱한다
      const formData = await request.formData()
      const file = formData.get("file") as File | null
      allowNewCategories = formData.get("allowNewCategories") === "true"
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

    // 카테고리 처리.
    // "상의"와 "tshirt"처럼 표기가 갈리면 카테고리가 조용히 늘어난다.
    // 기본은 기존 카테고리에만 매칭(대소문자·공백 무시)하고, 없으면 그
    // 상품을 실패로 떨어뜨려 오타를 드러낸다. 새 카테고리를 정말 만들
    // 때만 allowNewCategories 를 켜고 올린다.
    const categoryNames = [...new Set([...productGroups.values()].map((g) => g.category))]
    const categoryMap = new Map<string, string>()
    const allCategories = await prisma.category.findMany({ select: { id: true, name: true, slug: true } })
    const byNorm = new Map<string, string>()
    for (const c of allCategories) {
      byNorm.set(c.name.trim().toLowerCase(), c.id)
      byNorm.set(c.slug.trim().toLowerCase(), c.id)
    }
    const validNames = allCategories.map((c) => c.name).join(", ")

    for (const catName of categoryNames) {
      const norm = catName.trim().toLowerCase()
      let found = byNorm.get(norm) || byNorm.get(toSlug(catName))
      // 별칭(OUTER→아우터, INNER→이너웨어 등)으로 한 번 더 시도
      if (!found) {
        const alias = CATEGORY_ALIASES[catName.trim().toUpperCase()]
        if (alias) found = byNorm.get(alias.toLowerCase())
      }
      if (found) {
        categoryMap.set(catName, found)
      } else if (allowNewCategories) {
        const created = await prisma.category.create({ data: { name: catName, slug: toSlug(catName) } })
        categoryMap.set(catName, created.id)
        byNorm.set(norm, created.id)
      }
      // 못 찾으면 아래 그룹 처리에서 상품명 판독으로 마지막 시도를 한다
    }
    // 상품명 판독으로 분류된 내역(관리자가 검수할 수 있게 결과에 담는다)
    const autoMapped: { product: string; from: string; to: string }[] = []

    // 상품 생성/갱신
    let created = 0
    let updated = 0

    for (const [groupKey, group] of productGroups) {
      const productName = group.name
      try {
        let categoryId = categoryMap.get(group.category)
        if (!categoryId) {
          // 마지막 시도: 상품명 키워드로 판독 (예: "... T-SHIRT" → 상의)
          const inferred = inferCategoryFromName(group.name)
          const inferredId = inferred ? byNorm.get(inferred.toLowerCase()) : undefined
          if (inferredId) {
            categoryId = inferredId
            autoMapped.push({ product: group.name, from: group.category, to: inferred! })
          }
        }
        if (!categoryId) {
          failed.push({
            row: 0,
            error: group.category
              ? `알 수 없는 카테고리 "${group.category}" — 상품 "${group.name}" 건너뜀. 사용 가능: ${validNames}. 새 카테고리를 만들려면 [없는 카테고리 자동 생성]을 켜고 다시 올리세요.`
              : `상품 "${group.name}" — 카테고리가 비어 있고 상품명으로도 판별하지 못했습니다. 카테고리를 적어주세요. 사용 가능: ${validNames}`,
          })
          continue
        }

        const colorsMap = new Map<string, { colorCode: string; hexColor: string }>()
        const sizesSet = new Set<string>()

        for (const v of group.variants) {
          if (!colorsMap.has(v.colorName)) colorsMap.set(v.colorName, { colorCode: v.colorCode, hexColor: v.hexColor })
          sizesSet.add(v.sizeName)
        }

        // 정렬표에 없는 사이즈(8Y 등)도 자연 순서로 정렬한다
        const sortedSizes = sortSizeNames([...sizesSet])
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
              brand: group.brand || null,
              // 명시된 연도·시즌이 있으면 우선, 없으면 품번에서 유도
              seasonKey:
                seasonKeyFromExplicit(group.yearRaw, group.seasonRaw) ??
                seasonKeyFromCode(group.code),
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

          const colorIdMap = new Map(product.colors.map((c) => [c.name, c.id]))
          const sizeIdMap = new Map(product.sizes.map((sz) => [sz.name, sz.id]))

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
              ...(group.brand ? { brand: group.brand } : {}),
              ...(seasonKeyFromExplicit(group.yearRaw, group.seasonRaw)
                ? { seasonKey: seasonKeyFromExplicit(group.yearRaw, group.seasonRaw) }
                : {}),
              description: group.description || null,
              material: group.material || null,
              origin: group.origin || null,
              categoryId,
              priceCurrency: group.priceCurrency || "KRW",
              ageGroup,
            },
          })

          const colorIdMap = new Map(existing.colors.map((c) => [c.name, c.id]))
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

          const sizeIdMap = new Map(existing.sizes.map((sz) => [sz.name, sz.id]))
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
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err)
        failed.push({ row: 0, error: `상품 "${group.name}" (${groupKey}) 처리 실패: ${m}` })
      }
    }

    return NextResponse.json({ success: created + updated, created, updated, failed, autoMapped })
  } catch (error) {
    console.error("Bulk upload error:", error)
    // 관리자 전용 엔드포인트이므로 원인을 그대로 돌려준다.
    // 메시지를 감추면 대량등록 실패를 화면만 보고 진단할 수 없다.
    const err = error as { code?: string; message?: string }
    const detail = [err?.code, err?.message].filter(Boolean).join(" ")
    return NextResponse.json(
      { error: `엑셀 업로드 처리 중 오류가 발생했습니다. ${detail}`.trim() },
      { status: 500 },
    )
  }
}
