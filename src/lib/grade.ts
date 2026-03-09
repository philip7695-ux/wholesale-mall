import { prisma } from "@/lib/prisma"

// 기본값 (DB에 설정이 없을 때 fallback)
const DEFAULT_GRADE_DISCOUNT: Record<string, number> = {
  BRONZE: 0,
  SILVER: 0.05,
  GOLD: 0.1,
  VIP: 0.15,
}

const DEFAULT_GRADE_MOQ_RATE: Record<string, number> = {
  BRONZE: 1.0,
  SILVER: 1.0,
  GOLD: 0.5,
  VIP: 0.5,
}

const DEFAULT_GRADE_THRESHOLDS: Record<string, number> = {
  SILVER: 35000,
  GOLD: 200000,
}

// 하드코딩 exports (기존 코드 호환용)
export const GRADE_DISCOUNT = DEFAULT_GRADE_DISCOUNT
export const GRADE_MOQ_RATE = DEFAULT_GRADE_MOQ_RATE
export const GRADE_THRESHOLDS = DEFAULT_GRADE_THRESHOLDS

export interface GradeConfigData {
  grade: string
  discountRate: number
  moqRate: number
  threshold: number
}

// DB에서 등급 설정 조회, 없으면 기본값
export async function getGradeConfig(): Promise<GradeConfigData[]> {
  const configs = await prisma.gradeConfig.findMany({
    orderBy: { grade: "asc" },
  })

  if (configs.length > 0) return configs

  // DB에 설정이 없으면 기본값 반환
  return ["BRONZE", "SILVER", "GOLD", "VIP"].map((grade) => ({
    grade,
    discountRate: DEFAULT_GRADE_DISCOUNT[grade] ?? 0,
    moqRate: DEFAULT_GRADE_MOQ_RATE[grade] ?? 1.0,
    threshold: DEFAULT_GRADE_THRESHOLDS[grade] ?? 0,
  }))
}

// DB 설정 기반으로 할인율 조회
export async function getGradeDiscount(grade: string): Promise<number> {
  const config = await prisma.gradeConfig.findUnique({ where: { grade } })
  return config?.discountRate ?? DEFAULT_GRADE_DISCOUNT[grade] ?? 0
}

// DB 설정 기반으로 MOQ 비율 조회
export async function getGradeMoqRate(grade: string): Promise<number> {
  const config = await prisma.gradeConfig.findUnique({ where: { grade } })
  return config?.moqRate ?? DEFAULT_GRADE_MOQ_RATE[grade] ?? 1.0
}

// 등급 적용된 실제 MOQ 계산
export function getEffectiveMoq(moq: number, grade: string): number {
  if (moq <= 0) return 0
  const rate = DEFAULT_GRADE_MOQ_RATE[grade] ?? 1.0
  return Math.max(1, Math.ceil(moq * rate))
}

// DB 설정 기반 MOQ 계산 (async)
export async function getEffectiveMoqFromDb(moq: number, grade: string): Promise<number> {
  if (moq <= 0) return 0
  const rate = await getGradeMoqRate(grade)
  return Math.max(1, Math.ceil(moq * rate))
}

// KRW 누적 금액 + USD 환율로 등급 계산 (VIP 제외)
export async function calculateGradeFromDb(
  totalSpendingKRW: number,
  usdRate: number,
  currentGrade: string,
): Promise<string> {
  if (currentGrade === "VIP") return "VIP"

  const totalUSD = usdRate > 0 ? totalSpendingKRW / usdRate : 0
  const configs = await getGradeConfig()

  // threshold 높은 순으로 체크
  const sorted = configs
    .filter((c) => c.threshold > 0)
    .sort((a, b) => b.threshold - a.threshold)

  for (const config of sorted) {
    if (totalUSD >= config.threshold) return config.grade
  }
  return "BRONZE"
}

// 기존 동기 함수 유지 (하드코딩 기본값 사용)
export function calculateGrade(
  totalSpendingKRW: number,
  usdRate: number,
  currentGrade: string,
): string {
  if (currentGrade === "VIP") return "VIP"

  const totalUSD = usdRate > 0 ? totalSpendingKRW / usdRate : 0

  if (totalUSD >= (DEFAULT_GRADE_THRESHOLDS.GOLD ?? 200000)) return "GOLD"
  if (totalUSD >= (DEFAULT_GRADE_THRESHOLDS.SILVER ?? 35000)) return "SILVER"
  return "BRONZE"
}
