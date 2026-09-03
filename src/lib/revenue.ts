import { Prisma } from "@prisma/client"

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

/**
 * 주문 금액을 원화로 환산하는 SQL 식.
 *
 * 주문마다 통화가 다르다(국내 KRW, 수출 USD·CNY 등). 그대로 더하면 단위가
 * 섞인 숫자가 나온다. 환산은 주문에 남은 그 시점 환율로 한다. 오늘 환율로
 * 다시 계산하면 지난 달 매출이 환율 따라 흔들린다.
 */
export const AMOUNT_IN_KRW_SQL = Prisma.sql`("totalAmount" * "exchangeRate")`

/** 매출로 치는 주문의 SQL 조건. revenueWhere 의 raw SQL 판이다. */
export function revenueConditionsSql(from?: Date, to?: Date): Prisma.Sql {
  const conds: Prisma.Sql[] = [Prisma.sql`"status" = '${Prisma.raw(REVENUE_STATUS)}'`]
  if (from) conds.push(Prisma.sql`COALESCE("shippedAt", "createdAt") >= ${from}`)
  if (to) conds.push(Prisma.sql`COALESCE("shippedAt", "createdAt") < ${to}`)
  return Prisma.join(conds, " AND ")
}

/** 기간 매출 합계(원화 환산)와 주문 건수. */
export function revenueSummarySql(from?: Date, to?: Date): Prisma.Sql {
  return Prisma.sql`
    SELECT
      COALESCE(SUM(${AMOUNT_IN_KRW_SQL}), 0)::float8 AS total,
      COUNT(*)::int AS orders
    FROM mall."Order"
    WHERE ${revenueConditionsSql(from, to)}
  `
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
