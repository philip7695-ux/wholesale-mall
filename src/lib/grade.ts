// 등급별 할인율
export const GRADE_DISCOUNT: Record<string, number> = {
  BRONZE: 0,
  SILVER: 0.05,
  GOLD: 0.1,
  VIP: 0.15,
}

// 등급별 MOQ 비율 (1.0 = 100%, 0.5 = 50% 완화)
export const GRADE_MOQ_RATE: Record<string, number> = {
  BRONZE: 1.0,
  SILVER: 1.0,
  GOLD: 0.5,
  VIP: 0.5,
}

// 자동 승급 기준 (USD)
export const GRADE_THRESHOLDS: Record<string, number> = {
  SILVER: 35000,
  GOLD: 200000,
}

// 등급 적용된 실제 MOQ 계산
export function getEffectiveMoq(moq: number, grade: string): number {
  if (moq <= 0) return 0
  const rate = GRADE_MOQ_RATE[grade] ?? 1.0
  return Math.max(1, Math.ceil(moq * rate))
}

// KRW 누적 금액 + USD 환율로 등급 계산 (VIP 제외)
export function calculateGrade(
  totalSpendingKRW: number,
  usdRate: number,
  currentGrade: string,
): string {
  if (currentGrade === "VIP") return "VIP"

  const totalUSD = usdRate > 0 ? totalSpendingKRW / usdRate : 0

  if (totalUSD >= (GRADE_THRESHOLDS.GOLD ?? 200000)) return "GOLD"
  if (totalUSD >= (GRADE_THRESHOLDS.SILVER ?? 35000)) return "SILVER"
  return "BRONZE"
}

// GradeConfig 타입 (서버에서 DB 조회 시 사용)
export interface GradeConfigData {
  grade: string
  discountRate: number
  moqRate: number
  threshold: number
}
