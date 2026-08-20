"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { buyerPrice } from "@/lib/pricing"

interface Row {
  key: string
  label: string
  rate: number
  productCount: number
}

/**
 * 시즌별 도매 할인율.
 *
 * 상품에는 정상가(택가)가 들어 있고 바이어에게는 여기 비율을 적용한
 * 도매가가 보인다. 값을 잘못 넣으면 전 시즌 가격이 한꺼번에 틀어지므로,
 * 입력 즉시 예시 가격을 보여준다.
 */
export function SeasonDiscountForm({
  rows,
  gradeRates,
}: {
  rows: Row[]
  gradeRates: { grade: string; rate: number }[]
}) {
  const router = useRouter()
  const t = useTranslations("admin")
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.key, String(Math.round(r.rate * 100))])),
  )
  const [saving, setSaving] = useState<string | null>(null)

  async function save(key: string) {
    const pct = Number(values[key])
    if (!Number.isFinite(pct) || pct < 0 || pct > 95) {
      toast.error(t("seasonRateRange"))
      return
    }
    setSaving(key)
    try {
      const res = await fetch("/api/admin/season-discounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonKey: key, rate: pct / 100 }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(t("saved"))
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || t("saveFailed"))
    } finally {
      setSaving(null)
    }
  }

  const SAMPLE = 10000

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">{t("season")}</th>
            <th className="px-3 py-2 font-medium">{t("productCount")}</th>
            <th className="px-3 py-2 font-medium">{t("seasonRate")}</th>
            {gradeRates.map((g) => (
              <th key={g.grade} className="px-3 py-2 text-right font-medium">
                {g.grade}
                {g.rate > 0 && (
                  <span className="ml-1 font-normal text-muted-foreground">
                    +{Math.round(g.rate * 100)}%
                  </span>
                )}
              </th>
            ))}
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = Number(values[r.key])
            const rate = Number.isFinite(pct) ? pct / 100 : 0
            return (
              <tr key={r.key} className="border-t">
                <td className="px-3 py-2 font-mono">{r.label}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.productCount}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Input
                      value={values[r.key] ?? ""}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [r.key]: e.target.value.replace(/[^0-9]/g, "") }))
                      }
                      className="h-8 w-16 text-right"
                      inputMode="numeric"
                    />
                    <span className="text-muted-foreground">%</span>
                  </div>
                </td>
                {/* 택가 10,000원 기준 등급별 최종가 */}
                {gradeRates.map((g) => (
                  <td key={g.grade} className="px-3 py-2 text-right tabular-nums">
                    {buyerPrice(SAMPLE, rate, g.rate).toLocaleString()}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <Button size="sm" variant="outline" onClick={() => save(r.key)} disabled={saving === r.key}>
                    {saving === r.key && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    {t("apply")}
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {t("seasonRateHint", { sample: SAMPLE.toLocaleString() })}
      </p>
    </div>
  )
}
