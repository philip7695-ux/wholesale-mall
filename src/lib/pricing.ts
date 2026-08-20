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

/** 상품 코드에서 시즌 키를 뽑는다. BP63AC317 -> "63" */
export function seasonKeyFromCode(code: string | null | undefined): string | null {
  if (!code || code.length < 4) return null
  const key = code.slice(2, 4)
  return /^[0-9][1-9]$/.test(key) ? key : null
}

/** 두 할인율을 합친 값. 100% 를 넘지 않게 막는다. */
export function totalDiscountRate(seasonRate: number, gradeRate: number): number {
  const sum = (seasonRate || 0) + (gradeRate || 0)
  // 설정 실수로 가격이 0 이나 음수가 되면 주문이 통째로 망가진다
  return Math.min(Math.max(sum, 0), 0.95)
}

/** 정상가에 시즌·등급 할인을 적용한 최종 단가 */
export function buyerPrice(retailPrice: number, seasonRate: number, gradeRate: number): number {
  const rate = totalDiscountRate(seasonRate, gradeRate)
  return Math.round(retailPrice * (1 - rate) * 100) / 100
}

/** 상품 코드로 해당 시즌의 할인율을 찾는다. 설정이 없으면 0(정상가). */
export function seasonRateFor(
  code: string | null | undefined,
  rates: Record<string, number>,
): number {
  const key = seasonKeyFromCode(code)
  return key ? rates[key] ?? 0 : 0
}
