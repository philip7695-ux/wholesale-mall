/** 정상 주문 흐름 순서 (CANCELLED 제외) */
export const ORDER_STATUS_FLOW = [
  "ORDER_PLACED",
  // 창고 확인과 바이어 확인은 여러 번 오갈 수 있다. 흐름상으로는
  // 앞뒤 관계가 있지만, 두 단계 사이의 왕복은 따로 허용한다.
  "STOCK_CHECKING",
  "BUYER_REVIEW",
  "CONFIRMED",
  "INVOICE_SENT",
  "PAYMENT_CONFIRMED",
  "SHIPPED",
] as const

/** 상태별 배지 CSS 클래스 (Tailwind) */
export const STATUS_COLOR: Record<string, string> = {
  ORDER_PLACED: "bg-gray-100 text-gray-700 border-gray-300",
  STOCK_CHECKING: "bg-amber-100 text-amber-800 border-amber-300",
  BUYER_REVIEW: "bg-purple-100 text-purple-700 border-purple-300",
  CONFIRMED: "bg-indigo-100 text-indigo-700 border-indigo-300",
  INVOICE_SENT: "bg-gray-100 text-gray-700 border-gray-300",
  PAYMENT_CONFIRMED: "bg-blue-100 text-blue-700 border-blue-300",
  SHIPPED: "bg-green-100 text-green-700 border-green-300",
  CANCELLED: "bg-red-100 text-red-700 border-red-300",
}

/** 타임라인 dot 컬러 */
export const STATUS_DOT_COLOR: Record<string, string> = {
  ORDER_PLACED: "bg-gray-400",
  STOCK_CHECKING: "bg-amber-500",
  BUYER_REVIEW: "bg-purple-500",
  CONFIRMED: "bg-indigo-500",
  INVOICE_SENT: "bg-yellow-500",
  PAYMENT_CONFIRMED: "bg-blue-500",
  SHIPPED: "bg-green-500",
  CANCELLED: "bg-red-500",
}

/** 타임라인 텍스트 컬러 */
export const STATUS_TEXT_COLOR: Record<string, string> = {
  ORDER_PLACED: "text-gray-700",
  STOCK_CHECKING: "text-amber-800",
  BUYER_REVIEW: "text-purple-700",
  CONFIRMED: "text-indigo-700",
  INVOICE_SENT: "text-yellow-700",
  PAYMENT_CONFIRMED: "text-blue-700",
  SHIPPED: "text-green-700",
  CANCELLED: "text-red-700",
}

/**
 * 상태 전이 허용 여부 검증.
 * - 정상 흐름(ORDER_PLACED→INVOICE_SENT→PAYMENT_CONFIRMED→SHIPPED)에서 앞으로만 이동 가능
 * - 어떤 상태에서든 취소(CANCELLED) 가능 (이미 취소된 건 제외)
 * - CANCELLED는 종결 상태 — 되돌릴 수 없음
 * - 역방향(예: SHIPPED→ORDER_PLACED) 금지
 */
export function isValidStatusTransition(from: string, to: string): boolean {
  if (from === to) return true
  if (to === "CANCELLED") return from !== "CANCELLED"
  if (from === "CANCELLED") return false
  // 조정 단계는 서로 오갈 수 있다. 한 번에 합의되는 경우가 드물다.
  const revision = ["STOCK_CHECKING", "BUYER_REVIEW"]
  if (revision.includes(from) && revision.includes(to)) return true

  const fi = ORDER_STATUS_FLOW.indexOf(from as (typeof ORDER_STATUS_FLOW)[number])
  const ti = ORDER_STATUS_FLOW.indexOf(to as (typeof ORDER_STATUS_FLOW)[number])
  if (fi === -1 || ti === -1) return false
  return ti >= fi
}

/** 상태 → 타임스탬프 필드 매핑 */
export const STATUS_TIMESTAMP_FIELD: Record<string, string> = {
  ORDER_PLACED: "createdAt",
  CONFIRMED: "confirmedAt",
  INVOICE_SENT: "invoiceSentAt",
  PAYMENT_CONFIRMED: "paymentConfirmedAt",
  SHIPPED: "shippedAt",
  CANCELLED: "cancelledAt",
}
