"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

const currencies = [
  { code: "KRW", label: "KRW (Korean Won)", flag: "🇰🇷", editable: false },
  { code: "USD", label: "USD (US Dollar)", flag: "🇺🇸", editable: true },
  { code: "CNY", label: "CNY (Chinese Yuan)", flag: "🇨🇳", editable: true },
  { code: "JPY", label: "JPY (Japanese Yen)", flag: "🇯🇵", editable: true },
]

export function ExchangeRateForm({
  initialRates,
}: {
  initialRates: Record<string, number>
}) {
  const t = useTranslations("admin")
  const [rates, setRates] = useState<Record<string, string>>({
    USD: String(initialRates.USD || ""),
    CNY: String(initialRates.CNY || ""),
    JPY: String(initialRates.JPY || ""),
  })
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  async function handleSave(currency: string) {
    const rate = parseFloat(rates[currency])
    if (!rate || rate <= 0) {
      toast.error(t("rateInvalid"))
      return
    }

    setSaving((prev) => ({ ...prev, [currency]: true }))
    try {
      const res = await fetch("/api/exchange-rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency, rate }),
      })
      if (!res.ok) throw new Error()
      toast.success(t("rateSaved"))
    } catch {
      toast.error(t("rateSaveFail"))
    }
    setSaving((prev) => ({ ...prev, [currency]: false }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("rateLabel")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {currencies.map((c) => (
            <div key={c.code} className="flex items-center gap-4">
              <span className="w-48 text-sm font-medium">
                {c.flag} {c.label}
              </span>
              {c.editable ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">1 {c.code} =</span>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={rates[c.code]}
                      onChange={(e) =>
                        setRates((prev) => ({ ...prev, [c.code]: e.target.value }))
                      }
                      placeholder="0"
                      className="h-9 w-32 text-right"
                    />
                    <span className="text-sm text-muted-foreground">KRW</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSave(c.code)}
                    disabled={saving[c.code]}
                  >
                    {saving[c.code] ? t("orderSaving") : t("rateSaveButton")}
                  </Button>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">{t("baseCurrency")}</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
