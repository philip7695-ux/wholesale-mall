"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const PRESETS = [
  { value: "today", key: "revPresetToday" },
  { value: "week", key: "revPresetWeek" },
  { value: "month", key: "revPresetMonth" },
  { value: "last7", key: "revPresetLast7" },
  { value: "last30", key: "revPresetLast30" },
  { value: "lastMonth", key: "revPresetLastMonth" },
  { value: "year", key: "revPresetYear" },
] as const

export function RevenueFilter({
  preset,
  from,
  to,
}: {
  preset: string
  /** YYYY-MM-DD */
  from: string
  /** YYYY-MM-DD, 표시용이라 종료일 그대로다(쿼리의 미만 경계와 다름) */
  to: string
}) {
  const router = useRouter()
  const t = useTranslations("admin")
  const [customFrom, setCustomFrom] = useState(from)
  const [customTo, setCustomTo] = useState(to)

  const go = (params: Record<string, string>) => {
    const q = new URLSearchParams(params).toString()
    router.push(`/admin/revenue?${q}`)
  }

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.value}
            type="button"
            size="sm"
            variant={preset === p.value ? "default" : "outline"}
            onClick={() => go({ preset: p.value })}
          >
            {t(p.key)}
          </Button>
        ))}
      </div>

      <div className="flex items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t("revFrom")}</label>
          <Input
            type="date"
            value={customFrom}
            max={customTo || undefined}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="h-9 w-40"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">{t("revTo")}</label>
          <Input
            type="date"
            value={customTo}
            min={customFrom || undefined}
            onChange={(e) => setCustomTo(e.target.value)}
            className="h-9 w-40"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant={preset === "custom" ? "default" : "outline"}
          disabled={!customFrom || !customTo || customFrom > customTo}
          onClick={() => go({ preset: "custom", from: customFrom, to: customTo })}
          className={cn("h-9")}
        >
          {t("revApply")}
        </Button>
      </div>
    </div>
  )
}
