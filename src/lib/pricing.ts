/**
 * 도매가 계산.
 *
 * 상품에 저장된 가격은 정상가(택가)다. 원본 자료 그대로 두고 도매가는
 * 계산으로 뽑는다. 그래야 할인율만 바꿔도 전 상품이 따라오고, 나중에
 * 마진을 되짚을 수 있다.
 *
 *   바이어 가격 = 정상가 × (1 − 시즌 할인율 − 등급 할인율)
 *
 * 두 할인율은 곱하지 않고 더한다. 택가를 기준으로 "50% + 추가 5%" 라고
 * 말하는 방식에 맞춘 것이다(= 택가의 45%).
 */

// 시즌 키 판정은 lib/season.ts 한 곳에서만 한다
export { seasonKeyFromCode } from "@/lib/season"
import { seasonKeyFromCode } from "@/lib/season"

/** 두 할인율을 합친 값. 100% 를 넘지 않게 막는다. */
export function totalDiscountRate(seasonRate: number, gradeRate: number): number {
  const sum = (seasonRate || 0) + (gradeRate || 0)
  // 설정 실수로 가격이 0 이나 음수가 되면 주문이 통째로 망가진다
  return Math.min(Math.max(sum, 0), 0.95)
}

/**
 * 정상가에 시즌·등급 할인을 적용한 최종 단가.
 *
 * 스페셜 오퍼는 성격이 다르다. 시즌·등급은 택가를 기준으로 더하지만,
 * 스페셜 오퍼는 이미 할인된 가격에서 한 번 더 깎는다.
 * "50% 하던 걸 스페셜에 넣으면 거기서 30% 더" 라는 뜻이다.
 */
export function buyerPrice(
  retailPrice: number,
  seasonRate: number,
  gradeRate: number,
  specialRate = 0,
): number {
  const base = retailPrice * (1 - totalDiscountRate(seasonRate, gradeRate))
  const special = Math.min(Math.max(specialRate || 0, 0), 0.95)
  return Math.round(base * (1 - special) * 100) / 100
}

/** 상품 코드로 해당 시즌의 할인율을 찾는다. 설정이 없으면 0(정상가). */
export function seasonRateFor(
  code: string | null | undefined,
  rates: Record<string, number>,
  brand?: string | null,
): number {
  const key = seasonKeyFromCode(code)
  if (!key) return 0
  // 브랜드별 요율이 있으면 우선, 없으면 기본(전체 공통)으로 폴백
  if (brand && rates[`${brand}:${key}`] !== undefined) return rates[`${brand}:${key}`]
  return rates[key] ?? 0
}
