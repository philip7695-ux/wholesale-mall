/**
 * 동적 콘텐츠(DB 값) → locale 번역 유틸리티
 * next-intl의 t() 함수를 받아 해당 namespace에서 조회하고,
 * 사전에 없으면 원본을 그대로 반환한다.
 */

/** 카테고리 slug → 번역된 카테고리명 */
export function translateCategory(
  slug: string,
  t: (key: string) => string,
): string {
  // next-intl은 없는 키에 대해 키 자체를 반환하므로,
  // "categories.{slug}" 형태로 반환되면 fallback 처리
  const result = t(slug)
  return result === `categories.${slug}` ? slug : result
}

/** 한국어 컬러명 → 번역된 컬러명 */
export function translateColor(
  koreanName: string,
  t: (key: string) => string,
): string {
  const result = t(koreanName)
  return result === `colors.${koreanName}` ? koreanName : result
}

/** 한국어 사이즈 스펙 헤더 → 번역된 헤더명 */
export function translateSizeSpecHeader(
  header: string,
  t: (key: string) => string,
): string {
  const result = t(header)
  return result === `sizeSpec.${header}` ? header : result
}
