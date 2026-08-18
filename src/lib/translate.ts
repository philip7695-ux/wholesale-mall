/**
 * 동적 콘텐츠(DB 값) → locale 번역 유틸리티
 * next-intl의 t() 함수를 받아 해당 namespace에서 조회하고,
 * 사전에 없으면 원본을 그대로 반환한다.
 */

/** 카테고리 slug → 번역된 카테고리명 */
export function translateCategory(
  slug: string,
  t: (key: string) => string,
  fallback?: string,
): string {
  // next-intl 은 사전에 없는 키에서 예외를 던진다. 카테고리는 관리자가
  // 자유롭게 추가할 수 있으므로, 사전에 없다고 페이지 전체가 죽으면 안 된다.
  try {
    const result = t(slug)
    return result === `categories.${slug}` ? (fallback ?? slug) : result
  } catch {
    return fallback ?? slug
  }
}

/** 한국어 컬러명 → 번역된 컬러명 */
export function translateColor(
  koreanName: string,
  t: (key: string) => string,
): string {
  const result = t(koreanName)
  return result === `colors.${koreanName}` ? koreanName : result
}

/** 한국어 컬러명 → hex 색상값 자동 매핑 */
const COLOR_HEX_MAP: Record<string, string> = {
  블랙: "#1A1A1A",
  화이트: "#FFFFFF",
  네이비: "#1B2A4A",
  그레이: "#9E9E9E",
  차콜: "#4A4A4A",
  베이지: "#D4B896",
  아이보리: "#FFFFF0",
  크림: "#FFFDD0",
  카키: "#7B7B3A",
  브라운: "#795548",
  카멜: "#C19A6B",
  버건디: "#800020",
  와인: "#722F37",
  레드: "#E53935",
  핑크: "#F48FB1",
  오렌지: "#FB8C00",
  옐로우: "#FDD835",
  그린: "#43A047",
  민트: "#80CBC4",
  블루: "#1E88E5",
  스카이블루: "#81D4FA",
  퍼플: "#8E24AA",
  라벤더: "#CE93D8",
  실버: "#C0C0C0",
}

export function getColorHex(koreanName: string, hexColor?: string | null): string {
  if (hexColor) return hexColor
  return COLOR_HEX_MAP[koreanName] ?? "#CCCCCC"
}

/** 한국어 사이즈 스펙 헤더 → 번역된 헤더명 */
export function translateSizeSpecHeader(
  header: string,
  t: (key: string) => string,
): string {
  const result = t(header)
  return result === `sizeSpec.${header}` ? header : result
}
