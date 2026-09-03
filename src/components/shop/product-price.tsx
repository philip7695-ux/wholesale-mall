"use client"

import { formatCurrencyCross } from "@/lib/currency"
import { useCurrency } from "@/hooks/use-currency"


/**
 * 바이어에게 보이는 가격.
 *
 * 도매 사이트이므로 정상가(택가)는 보여주지 않는다. 이미 할인이 적용된
 * 도매가만 받는다.
 *
 * 할인 계산은 서버에서 한다. 예전에는 여기서 등급 할인을 다시 계산했는데,
 * 화면은 코드에 박힌 상수를, 주문은 DB 설정을 보고 있어서 관리자가 값을
 * 바꾸면 보이는 가격과 청구 금액이 갈라질 수 있었다.
 */
export function ProductPrice({
  price,
  priceCurrency,
}: {
  price: number
  priceCurrency: string
}) {
  const { currency, rates } = useCurrency()

  if (price <= 0) return <>-</>

  return <>{formatCurrencyCross(price, priceCurrency, currency, rates)}</>
}
