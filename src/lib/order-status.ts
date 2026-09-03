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

/**
 * 아직 돈이 오가기 전의 상태들.
 *
 * 배송지 수정, 주문 취소, 결제완료 자동 전이처럼 "입금 전이면 된다"는
 * 판단은 모두 여기를 본다. 조정 단계를 새로 넣을 때 이 목록만 고치면
 * 되도록 한곳에 모은다. 전에는 곳곳에 ORDER_PLACED 를 적어두어
 * 확정 단계가 생기자 여러 화면이 조용히 멈췄다.
 */
export const PRE_PAYMENT_STATUSES = [
  "ORDER_PLACED",
  "STOCK_CHECKING",
  "BUYER_REVIEW",
  "CONFIRMED",
  "INVOICE_SENT",
] as const

export function isPrePayment(status: string): boolean {
  return (PRE_PAYMENT_STATUSES as readonly string[]).includes(status)
}

/**
 * 바이어가 스스로 취소할 수 있는 상태.
 *
 * 확정은 창고 확인과 바이어 확인이 끝나 양쪽이 합의한 지점이다.
 * 그 뒤로는 한쪽이 혼자 되돌릴 일이 아니라 담당자와 이야기할 일이다.
 * 게다가 확정 시 예약이 실재고 차감으로 바뀌므로, 그냥 취소하면
 * 빠진 재고가 돌아오지 않고 조용히 사라진다.
 *
 * 관리자는 이 제한을 받지 않는다. 사유를 남기고 언제든 취소할 수 있다.
 */
export const BUYER_CANCELABLE_STATUSES = [
  "ORDER_PLACED",
  "STOCK_CHECKING",
  "BUYER_REVIEW",
] as const

export function canBuyerCancel(status: string): boolean {
  return (BUYER_CANCELABLE_STATUSES as readonly string[]).includes(status)
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

/**
 * 화면에 목록으로 늘어놓을 때 쓰는 전체 상태. 정상 흐름 뒤에 취소가 붙는다.
 *
 * 상태별 건수·필터처럼 "빠짐없이 보여줘야 하는" 자리에서는 이 목록을 돌려야 한다.
 * 화면마다 상태를 따로 적어두면 enum 이 늘었을 때 조용히 빠진다.
 * (대시보드에서 상태 하나가 빠져 렌더가 죽은 적이 있다.)
 */
export const ORDER_STATUS_ALL = [...ORDER_STATUS_FLOW, "CANCELLED"] as const

/** 상태 → admin 네임스페이스 번역 키 */
export const ORDER_STATUS_LABEL_KEYS: Record<string, string> = {
  ORDER_PLACED: "statusReceived",
  STOCK_CHECKING: "statusStockChecking",
  BUYER_REVIEW: "statusBuyerReview",
  CONFIRMED: "statusConfirmed",
  INVOICE_SENT: "statusInvoiceSent",
  PAYMENT_CONFIRMED: "statusPaymentConfirmed",
  SHIPPED: "statusShipped",
  CANCELLED: "statusCancelled",
}

/** 목록에 없는 상태가 들어와도 배지가 비어 보이지 않게 하는 기본값 */
export const STATUS_COLOR_FALLBACK = "bg-gray-100 text-gray-700 border-gray-300"
