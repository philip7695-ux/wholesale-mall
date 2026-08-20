"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Loader2, ChevronRight } from "lucide-react"
import { buyerPrice } from "@/lib/pricing"

export interface SeasonRow {
  key: string        // "53"
  label: string      // "25 FW"
  seasonName: string // "가을"
  year: string       // "5" (코드의 연도 한 자리)
  rate: number
  productCount: number
}

interface Grade {
  grade: string
  rate: number
}

const SAMPLE = 10000

/** 코드의 연도 한 자리를 연도로 편다. "6" -> 2026 (문자열로 이으면 206 이 된다) */
const fullYear = (digit: string) => 2020 + Number(digit)

/**
 * 시즌별 도매 할인율.
 *
 * 시즌이 16개라 한 줄씩 늘어놓으면 화면을 벗어난다. 연도로 접어두고
 * 눌렀을 때만 그 해의 네 시즌을 펼친다. 저장도 네 개를 한 번에 한다.
 */
export function SeasonDiscountForm({
  rows,
  gradeRates,
}: {
  rows: SeasonRow[]
  gradeRates: Grade[]
}) {
  const router = useRouter()
  const t = useTranslations("admin")
  const tc = useTranslations("common")
  const [openYear, setOpenYear] = useState<string | null>(null)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // 연도별로 묶는다. rows 는 이미 최신순이다.
  const years: { year: string; seasons: SeasonRow[] }[] = []
  for (const r of rows) {
    const found = years.find((y) => y.year === r.year)
    if (found) found.seasons.push(r)
    else years.push({ year: r.year, seasons: [r] })
  }

  function open(year: string) {
    const seasons = years.find((y) => y.year === year)?.seasons ?? []
    setDraft(Object.fromEntries(seasons.map((s) => [s.key, String(Math.round(s.rate * 100))])))
    setOpenYear(year)
  }

  async function saveYear() {
    const entries = Object.entries(draft)
    const bad = entries.find(([, v]) => {
      const n = Number(v)
      return !Number.isFinite(n) || n < 0 || n > 95
    })
    if (bad) {
      toast.error(t("seasonRateRange"))
      return
    }
    setSaving(true)
    try {
      // 네 시즌을 순차로 저장한다. 하나가 실패하면 거기서 멈추고 알린다.
      for (const [seasonKey, v] of entries) {
        const res = await fetch("/api/admin/season-discounts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seasonKey, rate: Number(v) / 100 }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
      }
      toast.success(t("saved"))
      setOpenYear(null)
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const current = years.find((y) => y.year === openYear)

  return (
    <>
      <div className="overflow-hidden rounded-lg border">
        {years.map((y) => {
          const rates = y.seasons.map((s) => Math.round(s.rate * 100))
          const min = Math.min(...rates)
          const max = Math.max(...rates)
          const total = y.seasons.reduce((s, x) => s + x.productCount, 0)
          return (
            <button
              key={y.year}
              onClick={() => open(y.year)}
              className="flex w-full items-center gap-4 border-b px-4 py-3 text-left last:border-b-0 hover:bg-muted/50"
            >
              <span className="w-16 font-mono text-base">{fullYear(y.year)}</span>
              <span className="w-24 text-sm text-muted-foreground">
                {t("productCount")} {total.toLocaleString()}
              </span>
              <span className="flex-1 text-sm">
                {min === max ? (
                  min === 0 ? (
                    <span className="text-muted-foreground">{t("seasonRateUnset")}</span>
                  ) : (
                    `${min}%`
                  )
                ) : (
                  `${min}~${max}%`
                )}
              </span>
              <span className="hidden gap-1.5 text-xs text-muted-foreground sm:flex">
                {y.seasons.map((s) => (
                  <span key={s.key} className="rounded bg-muted px-1.5 py-0.5">
                    {s.seasonName} {Math.round(s.rate * 100)}%
                  </span>
                ))}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )
        })}
      </div>

      <Dialog open={openYear !== null} onOpenChange={(v) => !v && setOpenYear(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{openYear && fullYear(openYear)} {t("seasonRate")}</DialogTitle>
          </DialogHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">{t("season")}</th>
                  <th className="py-2 font-medium">{t("productCount")}</th>
                  <th className="py-2 font-medium">{t("seasonRate")}</th>
                  {gradeRates.map((g) => (
                    <th key={g.grade} className="py-2 text-right font-medium">
                      {g.grade}
                      {g.rate > 0 && <span className="ml-1 font-normal">+{Math.round(g.rate * 100)}%</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {current?.seasons.map((s) => {
                  const pct = Number(draft[s.key])
                  const rate = Number.isFinite(pct) ? pct / 100 : 0
                  return (
                    <tr key={s.key} className="border-t">
                      <td className="py-2">{s.seasonName}</td>
                      <td className="py-2 text-muted-foreground">{s.productCount}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <Input
                            value={draft[s.key] ?? ""}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                [s.key]: e.target.value.replace(/[^0-9]/g, ""),
                              }))
                            }
                            className="h-8 w-16 text-right"
                            inputMode="numeric"
                          />
                          <span className="text-muted-foreground">%</span>
                        </div>
                      </td>
                      {gradeRates.map((g) => (
                        <td key={g.grade} className="py-2 text-right tabular-nums">
                          {buyerPrice(SAMPLE, rate, g.rate).toLocaleString()}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            {t("seasonRateHint", { sample: SAMPLE.toLocaleString() })}
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenYear(null)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button onClick={saveYear} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
