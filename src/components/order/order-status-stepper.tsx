"use client"

import { useTranslations } from "next-intl"
import { Check, X } from "lucide-react"

/**
 * 주문 진행 스텝퍼. 관리자·바이어 양쪽에서 같은 로직으로 쓴다.
 *
 * 전체 흐름을 항상 다 그려두고, 지나온 단계는 컬러로 켜고 앞으로 올
 * 단계는 회색으로 둔다. "지금 어디쯤이고 다음은 뭔지"를 한눈에 준다.
 *
 * 조정 왕복(STOCK_CHECKING↔BUYER_REVIEW)은 바이어 눈높이에서 한 칸
 * "수량조정"으로 묶는다. 실제 상태 enum 은 그대로 두고 표시만 합친다.
 */
type Step = {
  key: string
  labelKey: string
  match: readonly string[]
  dot: string
  ring: string
  text: string
}

const PLACED: Step = { key: "ORDER_PLACED", labelKey: "statusOrderPlaced", match: ["ORDER_PLACED"], dot: "bg-sky-500", ring: "ring-sky-200", text: "text-sky-600" }
const TAIL: Step[] = [
  { key: "CONFIRMED", labelKey: "statusConfirmed", match: ["CONFIRMED"], dot: "bg-indigo-500", ring: "ring-indigo-200", text: "text-indigo-600" },
  { key: "INVOICE_SENT", labelKey: "statusInvoiceSent", match: ["INVOICE_SENT"], dot: "bg-violet-500", ring: "ring-violet-200", text: "text-violet-600" },
  { key: "PAYMENT_CONFIRMED", labelKey: "statusPaymentConfirmed", match: ["PAYMENT_CONFIRMED"], dot: "bg-blue-600", ring: "ring-blue-200", text: "text-blue-700" },
  { key: "SHIPPED", labelKey: "statusShipped", match: ["SHIPPED"], dot: "bg-emerald-500", ring: "ring-emerald-200", text: "text-emerald-600" },
]

/** 바이어용 — 조정 왕복을 한 칸으로 묶는다 */
const STEPS: Step[] = [
  PLACED,
  { key: "REVIEW", labelKey: "statusReview", match: ["STOCK_CHECKING", "BUYER_REVIEW"], dot: "bg-amber-500", ring: "ring-amber-200", text: "text-amber-600" },
  ...TAIL,
]

/**
 * 관리자용 — 조정 왕복을 두 칸으로 가른다.
 *
 * 관리자에게는 "지금 누구 차례인가"가 곧 할 일이다. 한 칸으로 묶으면
 * 내가 창고 답을 기다리는 중인지, 바이어 회신을 기다리는 중인지가
 * 스텝퍼에서 사라진다.
 */
const STEPS_SPLIT: Step[] = [
  PLACED,
  { key: "STOCK_CHECKING", labelKey: "statusStockChecking", match: ["STOCK_CHECKING"], dot: "bg-amber-500", ring: "ring-amber-200", text: "text-amber-600" },
  { key: "BUYER_REVIEW", labelKey: "statusBuyerReview", match: ["BUYER_REVIEW"], dot: "bg-purple-500", ring: "ring-purple-200", text: "text-purple-600" },
  ...TAIL,
]

export function OrderStatusStepper({
  status,
  size = "md",
  className = "",
  split = false,
}: {
  status: string
  size?: "sm" | "md"
  className?: string
  /** 관리자 화면. 재고확인중·바이어확인중을 따로 그린다. */
  split?: boolean
}) {
  const t = useTranslations("order")
  const steps = split ? STEPS_SPLIT : STEPS

  // 취소는 흐름 밖의 종결 상태. 스텝퍼 대신 취소 표시를 그린다.
  if (status === "CANCELLED") {
    return (
      <div
        className={`flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ${className}`}
      >
        <X className="h-4 w-4" />
        {t("statusCancelled")}
      </div>
    )
  }

  const currentIndex = steps.findIndex((s) => s.match.includes(status))

  const dotSize = size === "sm" ? "h-6 w-6" : "h-8 w-8"
  // dot 세로 중심 = 커넥터가 걸릴 높이
  const connectorTop = size === "sm" ? "top-3" : "top-4"
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4"
  const labelSize = size === "sm" ? "text-[10px]" : "text-xs"

  return (
    <div className={`flex items-start ${className}`}>
      {steps.map((step, i) => {
        const done = currentIndex >= 0 && i < currentIndex
        const active = currentIndex >= 0 && i === currentIndex
        const reached = done || active

        return (
          <div key={step.key} className="relative flex flex-1 flex-col items-center">
            {/* 이전 단계와 잇는 선. 여기까지 도달했으면 컬러, 아니면 회색. */}
            {i > 0 && (
              <div
                className={`absolute ${connectorTop} left-[-50%] h-0.5 w-full -translate-y-1/2 ${
                  reached ? step.dot : "bg-gray-200"
                }`}
              />
            )}
            <div
              className={`relative z-10 flex ${dotSize} items-center justify-center rounded-full ${
                reached
                  ? `${step.dot} text-white`
                  : "border border-gray-200 bg-gray-100 text-gray-400"
              } ${active ? `ring-4 ${step.ring}` : ""}`}
            >
              {done ? (
                <Check className={iconSize} />
              ) : (
                <span className={size === "sm" ? "text-[10px] font-semibold" : "text-xs font-semibold"}>
                  {i + 1}
                </span>
              )}
            </div>
            <span
              className={`mt-1.5 text-center leading-tight ${labelSize} ${
                active
                  ? `${step.text} font-semibold`
                  : reached
                    ? "text-gray-600"
                    : "text-gray-400"
              }`}
            >
              {t(step.labelKey)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
