"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"

interface Balance {
  currency: string
  amount: {
    value: number
    currency: string
  }
}

export function WiseBalanceWidget() {
  const t = useTranslations("admin")
  const [balances, setBalances] = useState<Balance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch("/api/admin/wise/balance")
      .then((res) => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then((data) => {
        setBalances(data.balances ?? [])
      })
      .catch(() => {
        setError(true)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">{t("wiseBalance")}</h2>
        <div className="mt-4 animate-pulse space-y-2">
          <div className="h-8 w-32 rounded bg-gray-200" />
          <div className="h-8 w-24 rounded bg-gray-200" />
        </div>
      </div>
    )
  }

  if (error || balances.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">{t("wiseBalance")}</h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {balances.map((b) => (
          <div key={b.currency} className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">{b.amount.currency}</p>
            <p className="mt-1 text-lg font-bold">
              {b.amount.value.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
