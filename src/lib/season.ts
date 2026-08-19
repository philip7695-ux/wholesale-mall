/**
 * 상품 코드에서 연도와 시즌을 읽는다.
 *
 * 코드는 BP + 연도 한 자리 + 시즌 한 자리 + 나머지로 되어 있다.
 * 예) BP61AC317 = 2026년(6) 봄(1)
 *
 * Product 에는 연도·시즌 필드가 없어 코드가 유일한 근거다.
 */

export const YEAR_DIGITS = ["3", "4", "5", "6"] as const
export const SEASON_DIGITS = ["1", "2", "3", "4"] as const

/** 연도 숫자 → 표기 (3 → 2023) */
export function yearLabel(digit: string): string {
  return `20${20 + Number(digit)}`
}

export const SEASON_KEYS: Record<string, string> = {
  "1": "seasonSpring",
  "2": "seasonSummer",
  "3": "seasonFall",
  "4": "seasonWinter",
}

/**
 * 선택된 연도·시즌에 해당하는 코드 접두어 목록.
 * 한쪽만 고르면 나머지는 전부를 뜻한다.
 */
export function codePrefixes(year?: string, season?: string): string[] {
  const years = year && YEAR_DIGITS.includes(year as never) ? [year] : [...YEAR_DIGITS]
  const seasons = season && SEASON_DIGITS.includes(season as never) ? [season] : [...SEASON_DIGITS]
  return years.flatMap((y) => seasons.map((s) => `BP${y}${s}`))
}
