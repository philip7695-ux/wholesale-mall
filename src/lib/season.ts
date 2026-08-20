/**
 * 상품 코드에서 연도와 시즌을 읽는다.
 *
 * 코드는 라인코드 두 자리 + 연도 한 자리 + 시즌 한 자리 + 나머지로 되어 있다.
 * 예) BP61AC317 = BEBEDEPINO(BP) 2026년(6) 봄(1)
 *     BU54AH301 = Bumkins(BU)   2025년(5) 겨울(4)
 *
 * Product 에는 연도·시즌 필드가 없어 코드가 유일한 근거다.
 */

/** 코드 앞 두 자리 = 라인. 브랜드가 늘면 여기에 추가한다. */
export const LINE_CODES = ["BP", "BU"] as const

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
 *
 * 라인(BP/BU)을 모두 포함해야 한다. BP 만 넣으면 Bumkins 상품이
 * 연도·시즌 필터에서 통째로 사라진다.
 */
export function codePrefixes(year?: string, season?: string): string[] {
  const years = year && YEAR_DIGITS.includes(year as never) ? [year] : [...YEAR_DIGITS]
  const seasons = season && SEASON_DIGITS.includes(season as never) ? [season] : [...SEASON_DIGITS]
  return LINE_CODES.flatMap((line) => years.flatMap((y) => seasons.map((s) => `${line}${y}${s}`)))
}

/** 업계 표기. "2023년 봄" 대신 "23 SS" 로 적어야 이월처럼 보이지 않는다. */
export const SEASON_SHORT: Record<string, string> = {
  "1": "SS",
  "2": "SU",
  "3": "FW",
  "4": "WI",
}

/** 예) ("6","3") -> "26 FW" */
export function seasonLabel(year: string, season: string): string {
  return `${20 + Number(year)} ${SEASON_SHORT[season] ?? season}`
}

/**
 * 연도는 최신순, 계절은 봄→겨울 순으로 정렬된 목록.
 *
 * 계절까지 뒤집으면 "겨울 가을 여름 봄" 이 되어 읽기 어색하다.
 * 최신 연도를 위에 올리는 것과, 한 해 안에서 순서대로 읽는 것은 다른 문제다.
 */
export function seasonsNewestFirst(): { year: string; season: string; key: string; label: string }[] {
  const out: { year: string; season: string; key: string; label: string }[] = []
  for (const y of [...YEAR_DIGITS].reverse()) {
    for (const s of SEASON_DIGITS) {
      out.push({ year: y, season: s, key: `${y}${s}`, label: seasonLabel(y, s) })
    }
  }
  return out
}
