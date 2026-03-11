export const ADULT_SIZES: string[] = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "FREE"]
export const KIDS_NUM_SIZES: string[] = ["80", "85", "90", "95", "100", "110", "120", "130", "140"]
export const KIDS_LETTER_SIZES: string[] = ["F", "S", "M", "L"]
export const KIDS_SIZES: string[] = [...KIDS_LETTER_SIZES, ...KIDS_NUM_SIZES]
export const ALL_SIZES: string[] = [...ADULT_SIZES, ...KIDS_SIZES]

const BABY_NUM_SIZES = new Set(["80", "85", "90", "95", "100"])
const KIDS_ONLY_NUM_SIZES = new Set(["110", "120", "130", "140"])

/**
 * 상품명과 사이즈 목록으로 연령대(BABY/KIDS) 자동 판별
 * - 숫자 사이즈 100 이하 + 상품명에 "baby" → BABY
 * - 숫자 사이즈 110 이상 + 상품명에 "baby" 없음 → KIDS
 * - 문자 사이즈(F,S,M,L)만 있는 경우 → 상품명으로 판별
 * - 성인 사이즈(XS~3XL, FREE)만 → null
 */
export function determineAgeGroup(productName: string, sizeNames: string[]): "BABY" | "KIDS" | null {
  const nameLower = productName.toLowerCase()
  const hasBaby = nameLower.includes("baby")

  const hasBabyNumSize = sizeNames.some((s) => BABY_NUM_SIZES.has(s))
  const hasKidsNumSize = sizeNames.some((s) => KIDS_ONLY_NUM_SIZES.has(s))
  const hasKidsLetterSize = sizeNames.some((s) => KIDS_LETTER_SIZES.includes(s))
  const hasAdultOnlySize = sizeNames.some((s) =>
    ["XS", "XL", "2XL", "3XL", "FREE"].includes(s),
  )

  // 숫자 사이즈 기반 판별
  // 80~100 사이즈는 무조건 BABY (이름 무관)
  if (hasBabyNumSize) return "BABY"
  if (hasKidsNumSize && !hasBaby) return "KIDS"
  // 키즈 숫자 사이즈 + baby 이름 → BABY
  if (hasKidsNumSize && hasBaby) return "BABY"

  // 성인 전용 사이즈만 있으면 null
  if (hasAdultOnlySize && !hasKidsLetterSize) return null

  // 문자 사이즈(F,S,M,L)만 있는 경우 → 상품명으로 판별
  if (hasKidsLetterSize) {
    return hasBaby ? "BABY" : "KIDS"
  }

  return null
}
