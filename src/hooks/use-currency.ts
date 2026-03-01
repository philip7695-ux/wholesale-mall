"use client"

import { useEffect, useState } from "react"
import { useLocale } from "next-intl"

interface CurrencyState {
  currency: string
  rate: number
  loading: boolean
}

export function useCurrency(): CurrencyState {
  const locale = useLocale()
  const [state, setState] = useState<CurrencyState>({
    currency: "KRW",
    rate: 1,
    loading: true,
  })

  useEffect(() => {
    fetch(`/api/exchange-rates/current?locale=${locale}`)
      .then((res) => res.json())
      .then((data) => {
        setState({ currency: data.currency, rate: data.rate, loading: false })
      })
      .catch(() => {
        setState({ currency: "KRW", rate: 1, loading: false })
      })
  }, [locale])

  return state
}
