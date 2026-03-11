/** 정상 주문 흐름 순서 (CANCELLED 제외) */
export const ORDER_STATUS_FLOW = [
  "ORDER_PLACED",
  "INVOICE_SENT",
  "PAYMENT_CONFIRMED",
  "SHIPPED",
] as const

/** 상태별 배지 CSS 클래스 (Tailwind) */
export const STATUS_COLOR: Record<string, string> = {
  ORDER_PLACED: "bg-gray-100 text-gray-700 border-gray-300",
  INVOICE_SENT: "bg-gray-100 text-gray-700 border-gray-300",
  PAYMENT_CONFIRMED: "bg-blue-100 text-blue-700 border-blue-300",
  SHIPPED: "bg-green-100 text-green-700 border-green-300",
  CANCELLED: "bg-red-100 text-red-700 border-red-300",
}

/** 타임라인 dot 컬러 */
export const STATUS_DOT_COLOR: Record<string, string> = {
  ORDER_PLACED: "bg-gray-400",
  INVOICE_SENT: "bg-yellow-500",
  PAYMENT_CONFIRMED: "bg-blue-500",
  SHIPPED: "bg-green-500",
  CANCELLED: "bg-red-500",
}

/** 타임라인 텍스트 컬러 */
export const STATUS_TEXT_COLOR: Record<string, string> = {
  ORDER_PLACED: "text-gray-700",
  INVOICE_SENT: "text-yellow-700",
  PAYMENT_CONFIRMED: "text-blue-700",
  SHIPPED: "text-green-700",
  CANCELLED: "text-red-700",
}

/** 상태 → 타임스탬프 필드 매핑 */
export const STATUS_TIMESTAMP_FIELD: Record<string, string> = {
  ORDER_PLACED: "createdAt",
  INVOICE_SENT: "invoiceSentAt",
  PAYMENT_CONFIRMED: "paymentConfirmedAt",
  SHIPPED: "shippedAt",
  CANCELLED: "cancelledAt",
}
