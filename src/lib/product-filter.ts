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
}

export function buildProductWhere(params: ProductFilterParams): Record<string, unknown> {
  const { category, season, ageGroup, search, specialOnly } = params

  const where: Record<string, unknown> = { isActive: true }
  if (category) where.category = { slug: category }
  if (specialOnly) where.specialOffer = true
  if (isAgeGroup(ageGroup)) where.ageGroup = ageGroup
  // 시즌은 상품 코드 접두어로만 알 수 있다(라인 + 연도 + 시즌)
  if (season && /^[3-6][1-4]?$/.test(season)) {
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
