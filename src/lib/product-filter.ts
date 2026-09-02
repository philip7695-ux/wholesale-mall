import { isAgeGroup } from "@/lib/age-group"

/**
 * 쇼핑몰 상품 목록의 필터 조건을 Prisma where 로 만든다.
 *
 * 목록 페이지와 엑셀 주문서 다운로드가 "똑같이 필터된 상품"을 보게
 * 하려면 조건을 한곳에서 만들어야 한다. 페이지에 흩어져 있던 로직을
 * 여기로 모은다.
 */
export interface ProductFilterParams {
  category?: string
  season?: string
  ageGroup?: string
  search?: string
  specialOnly?: boolean
  brand?: string
}

export function buildProductWhere(params: ProductFilterParams): Record<string, unknown> {
  const { category, season, ageGroup, search, specialOnly, brand } = params

  const where: Record<string, unknown> = { isActive: true }
  if (category) where.category = { slug: category }
  if (brand) where.brand = brand
  if (specialOnly) where.specialOffer = true
  if (isAgeGroup(ageGroup)) where.ageGroup = ageGroup
  // 시즌은 상품 코드 접두어로만 알 수 있다(라인 + 연도 + 시즌)
  if (season && /^[3-9][1-4]?$/.test(season)) {
    where.seasonKey = season.length === 2 ? season : { startsWith: season }
  }
  // 시즌과 검색은 둘 다 OR 묶음이라 AND 로 묶어 둘 다 걸리게 한다.
  const and: Record<string, unknown>[] = []
  if (search) {
    and.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
      ],
    })
  }
  if (and.length) where.AND = and
  return where
}

/**
 * 어드민 상품 목록·엑셀 내보내기 공용 필터.
 *
 * 목록 화면에서 걸어 둔 조건(연도·시즌·카테고리·브랜드·코드)이
 * 엑셀 다운로드에도 똑같이 적용되도록 조건을 한곳에서 만든다.
 */
export interface AdminProductFilterParams {
  year?: string
  season?: string
  category?: string // categoryId
  brand?: string
  code?: string
}

export function buildAdminProductWhere(params: AdminProductFilterParams): Record<string, unknown> {
  const { year, season, category, brand, code } = params
  const where: Record<string, unknown> = {}
  // 연도·시즌은 seasonKey(코드 3~4번째 두 자리)로 거른다.
  // 둘 다 비면 조건을 걸지 않아 코드 없는 상품도 남는다.
  if (year && season) where.seasonKey = `${year}${season}`
  else if (year) where.seasonKey = { startsWith: year }
  else if (season) where.seasonKey = { endsWith: season }
  if (category) where.categoryId = category
  if (brand) where.brand = brand
  // 스타일 넘버는 일부만 넣어도 찾는다
  if (code) where.code = { contains: code, mode: "insensitive" }
  return where
}

/**
 * 엑셀 주문서 팝업용 다중선택 필터. 연도·연령대·카테고리를 각각 여러 개
 * 고를 수 있다(중복선택). 빈 배열은 그 항목에 제한을 두지 않는다(=전체).
 */
export function buildProductWhereMulti(params: {
  categories?: string[]
  years?: string[]
  seasons?: string[]
  ageGroups?: string[]
  brands?: string[]
  specialOnly?: boolean
}): Record<string, unknown> {
  const where: Record<string, unknown> = { isActive: true }
  if (params.categories?.length) where.category = { slug: { in: params.categories } }
  if (params.brands?.length) where.brand = { in: params.brands }
  if (params.ageGroups?.length) where.ageGroup = { in: params.ageGroups }
  if (params.specialOnly) where.specialOffer = true
  // 시즌키는 연도 digit + 계절 digit 두 자리다. 연도만 고르면 그 해 전체,
  // 계절만 고르면 모든 해의 그 계절, 둘 다 고르면 조합(연도×계절)이다.
  const years = params.years?.filter(Boolean) ?? []
  const seasons = params.seasons?.filter(Boolean) ?? []
  if (years.length && seasons.length) {
    where.seasonKey = { in: years.flatMap((y) => seasons.map((s) => `${y}${s}`)) }
  } else if (years.length) {
    where.OR = years.map((y) => ({ seasonKey: { startsWith: y } }))
  } else if (seasons.length) {
    where.OR = seasons.map((s) => ({ seasonKey: { endsWith: s } }))
  }
  return where
}
