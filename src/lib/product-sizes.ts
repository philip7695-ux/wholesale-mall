export const ADULT_SIZES: string[] = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "FREE"]
export const KIDS_NUM_SIZES: string[] = ["80", "85", "90", "95", "100", "110", "120", "130", "140", "150"]
// XL/XXL 은 BU(Bumkins) 이너웨어에서 실제로 쓰인다. 빼면 해당 사이즈를 주문할 수 없다.
export const KIDS_LETTER_SIZES: string[] = ["F", "S", "M", "L", "XL", "XXL"]
export const KIDS_SIZES: string[] = [...KIDS_LETTER_SIZES, ...KIDS_NUM_SIZES]
export const ALL_SIZES: string[] = [...ADULT_SIZES, ...KIDS_SIZES]

// 중복 없는 전체 사이즈 이름(엑셀 사이즈 열 감지에 쓴다)
export const ALL_SIZE_NAMES: string[] = [...new Set(ALL_SIZES)]
const SIZE_NAME_SET = new Set(ALL_SIZE_NAMES.map((s) => s.toUpperCase()))

/** 엑셀 헤더가 사이즈 열인지(알려진 사이즈 이름인지) 판단 */
export function isSizeColumn(header: string): boolean {
  return SIZE_NAME_SET.has(String(header).trim().toUpperCase())
}

/**
 * 여러 상품의 사이즈를 한 표에 펼칠 때 쓰는 정렬 순서.
 * 쓰던 오더시트를 따라 숫자 사이즈를 앞에 작은 것부터, 문자 사이즈를 뒤에 둔다.
 * 목록에 없는 값은 맨 뒤로 보내되 이름순으로 묶어 뒤죽박죽이 되지 않게 한다.
 */
const SIZE_ORDER = ["F", "XS", "S", "M", "L", "XL", "XXL", "2XL", "3XL", "FREE"]

export function sizeSortIndex(name: string): number {
  const v = name.trim().toUpperCase()
  const num = Number(v)
  if (Number.isFinite(num)) return num
  const letter = SIZE_ORDER.indexOf(v)
  if (letter >= 0) return 10000 + letter
  return 20000
}

/** 사이즈 이름들을 표의 열 순서대로 정렬한다. */
export function sortSizeNames(names: string[]): string[] {
  return [...names].sort((a, b) => {
    const d = sizeSortIndex(a) - sizeSortIndex(b)
    return d !== 0 ? d : a.localeCompare(b)
  })
}

const BABY_NUM_SIZES = new Set(["80", "85", "90", "95", "100"])
const KIDS_ONLY_NUM_SIZES = new Set(["110", "120", "130", "140", "150"])

export type AgeGroupValue = "NEWBORN" | "BABY" | "KIDS" | "ADULT"

/** 엑셀의 "연령대" 값을 enum 으로 정규화. 인식 못하면 null */
export function normalizeAgeGroup(raw: string): AgeGroupValue | null {
  const v = raw.trim().toUpperCase()
  if (!v) return null
  if (v.includes("NEWBORN") || v.includes("뉴본") || v.includes("신생아")) return "NEWBORN"
  if (v.includes("BABY") || v.includes("베이비") || v.includes("유아")) return "BABY"
  if (v.includes("KIDS") || v.includes("KID") || v.includes("키즈") || v.includes("아동")) return "KIDS"
  if (v.includes("ADULT") || v.includes("성인") || v.includes("어른")) return "ADULT"
  return null
}

/**
 * 상품명과 사이즈 목록으로 연령대(NEWBORN/BABY/KIDS) 자동 판별
 * - 상품명에 "newborn" + 아동 전용 숫자 사이즈 없음 → NEWBORN
 * - 80~100만 있음 → BABY
 * - 110+만 있음 → KIDS
 * - 80~100 + 110+ 둘 다 → 상품명에 "baby" 있으면 BABY, 없으면 KIDS
 * - 문자 사이즈(F,S,M,L)만 → 상품명으로 판별
 * - 성인 사이즈(XS~3XL, FREE)만 → null
 */
export function determineAgeGroup(productName: string, sizeNames: string[]): AgeGroupValue | null {
  const nameLower = productName.toLowerCase()
  const hasBaby = nameLower.includes("baby")
  const hasNewborn = nameLower.includes("newborn")

  // 뉴본은 F/S/M/L 또는 소형 사이즈로만 나오므로, 아동 전용 사이즈가 없을 때만 인정
  if (hasNewborn && !sizeNames.some((s) => KIDS_ONLY_NUM_SIZES.has(s))) return "NEWBORN"

  const hasBabyNumSize = sizeNames.some((s) => BABY_NUM_SIZES.has(s))
  const hasKidsNumSize = sizeNames.some((s) => KIDS_ONLY_NUM_SIZES.has(s))
  const hasKidsLetterSize = sizeNames.some((s) => KIDS_LETTER_SIZES.includes(s))
  const hasAdultOnlySize = sizeNames.some((s) =>
    ["XS", "XL", "2XL", "3XL", "FREE"].includes(s),
  )

  // 숫자 사이즈 기반 판별
  if (hasBabyNumSize && !hasKidsNumSize) return "BABY"
  if (hasKidsNumSize && !hasBabyNumSize) return "KIDS"
  // 둘 다 있으면 상품명으로 판별
  if (hasBabyNumSize && hasKidsNumSize) return hasBaby ? "BABY" : "KIDS"

  // 성인 전용 사이즈만 있으면 null
  if (hasAdultOnlySize && !hasKidsLetterSize) return null

  // 문자 사이즈(F,S,M,L)만 있는 경우 → 상품명으로 판별
  if (hasKidsLetterSize) {
    return hasBaby ? "BABY" : "KIDS"
  }

  return null
}
