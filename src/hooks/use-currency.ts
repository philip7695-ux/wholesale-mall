"use client"

import { useEffect, useState } from "react"
import { useLocale } from "next-intl"
import { useSession } from "next-auth/react"
import { resolveTradeTerms, type TradeType } from "@/lib/trade"

interface CurrencyState {
  /** 이 회원에게 청구되는 통화. 접속 언어가 아니라 거래 유형이 정한다. */
  currency: string
  /** KRW → currency 환율 */
  rate: number
  rates: Record<string, number>
  loading: boolean
}

/**
 * 화면에 쓸 통화와 환율.
 *
 * 국내 거래 회원은 어떤 언어로 보든 원화다. 언어를 따라가면 영어로 보는
 * 국내 고객에게 달러 가격을 보여주고 정작 청구는 원화로 나가, 보이는 값과
 * 청구액이 갈린다. 통화는 resolveTradeTerms 한 곳에서만 정한다.
 */
export function useCurrency(): CurrencyState {
  const locale = useLocale()
  const { data: session } = useSession()
  const [rates, setRates] = useState<Record<string, number>>({ KRW: 1 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/exchange-rates/current")
      .then((res) => res.json())
      .then((data) => setRates(data.rates || { KRW: 1 }))
      .catch(() => setRates({ KRW: 1 }))
      .finally(() => setLoading(false))
  }, [])

  const { currency } = resolveTradeTerms(
    {
      tradeType: (session?.user?.tradeType as TradeType | null) ?? null,
      currency: session?.user?.currency ?? null,
    },
    locale,
  )
  const rate = currency === "KRW" ? 1 : rates[currency] ?? 1

  return { currency, rate, rates, loading }
}
