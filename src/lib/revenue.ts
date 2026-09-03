import type { Prisma } from "@prisma/client"

/**
 * 매출로 인정하는 기준.
 *
 * 출하완료(SHIPPED)된 주문만 매출로 잡는다. 접수·재고확인중·바이어확인중 단계는
 * 수량이 아직 바뀔 수 있어 매출로 세지 않는다(사용자 결정, 2026-09-03).
 */
export const REVENUE_STATUS = "SHIPPED" as const

/**
 * 매출 시점은 출하일이다. 출하일이 기록되기 전에 SHIPPED 로 넘어간 옛 데이터가
 * 있을 수 있어 주문일로 갈음한다. raw SQL 에서도 같은 식을 써야 한다.
 */
export const REVENUE_DATE_SQL = `COALESCE("shippedAt", "createdAt")`

/** 기간(from 이상, to 미만)의 매출 주문 조건. 인자를 비우면 전 기간이다. */
export function revenueWhere(from?: Date, to?: Date): Prisma.OrderWhereInput {
  if (!from && !to) return { status: REVENUE_STATUS }

  const range: Prisma.DateTimeFilter = {}
  if (from) range.gte = from
  if (to) range.lt = to

  return {
    status: REVENUE_STATUS,
    OR: [{ shippedAt: range }, { shippedAt: null, createdAt: range }],
  }
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** 주는 월요일에 시작한다(사용자 결정, 2026-09-03). */
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d)
  // getDay(): 0=일요일. 월요일이 0이 되도록 옮긴다.
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7))
  return s
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function addDays(d: Date, n: number): Date {
  const s = new Date(d)
  s.setDate(s.getDate() + n)
  return s
}

export const REVENUE_PRESETS = [
  "today",
  "week",
  "month",
  "last7",
  "last30",
  "lastMonth",
  "year",
  "custom",
] as const

export type RevenuePreset = (typeof REVENUE_PRESETS)[number]

export interface RevenueRange {
  preset: RevenuePreset
  /** 이 시각 이상 */
  from: Date
  /** 이 시각 미만 */
  to: Date
  /** 추이 차트를 일별로 그릴지 월별로 그릴지 */
  granularity: "day" | "month"
}

/** 하루 단위 날짜 문자열(YYYY-MM-DD)만 받는다. 그 외에는 null. */
function parseDateParam(v?: string): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  const [y, m, d] = v.split("-").map(Number)
  const parsed = new Date(y, m - 1, d)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatDateParam(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/**
 * URL 파라미터를 실제 기간으로 푼다. 값이 이상하면 조용히 기본값(최근 30일)으로 돌아간다.
 * to 는 "미만"이라 종료일 다음 날 0시다.
 */
export function resolveRange(
  presetParam?: string,
  fromParam?: string,
  toParam?: string,
  now: Date = new Date(),
): RevenueRange {
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)
  const preset = (REVENUE_PRESETS as readonly string[]).includes(presetParam ?? "")
    ? (presetParam as RevenuePreset)
    : "last30"

  const withGranularity = (from: Date, to: Date, p: RevenuePreset): RevenueRange => {
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000)
    return { preset: p, from, to, granularity: days > 62 ? "month" : "day" }
  }

  switch (preset) {
    case "today":
      return withGranularity(today, tomorrow, preset)
    case "week":
      return withGranularity(startOfWeek(now), tomorrow, preset)
    case "month":
      return withGranularity(startOfMonth(now), tomorrow, preset)
    case "last7":
      return withGranularity(addDays(today, -6), tomorrow, preset)
    case "lastMonth": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      return withGranularity(from, startOfMonth(now), preset)
    }
    case "year":
      return withGranularity(new Date(now.getFullYear(), 0, 1), tomorrow, preset)
    case "custom": {
      const from = parseDateParam(fromParam)
      const to = parseDateParam(toParam)
      // 한쪽만 왔거나 순서가 뒤집혔으면 기본값으로 돌아간다.
      if (!from || !to || from > to) return withGranularity(addDays(today, -29), tomorrow, "last30")
      return withGranularity(from, addDays(to, 1), preset)
    }
    default:
      return withGranularity(addDays(today, -29), tomorrow, "last30")
  }
}
