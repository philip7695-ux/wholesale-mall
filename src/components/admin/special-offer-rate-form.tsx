"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { buyerPrice } from "@/lib/pricing"

const SAMPLE = 10000

/**
 * 스페셜 오퍼 추가 할인율.
 *
 * 시즌·등급 할인은 택가를 기준으로 더하지만, 이 값은 이미 할인된
 * 가격에서 한 번 더 깎는다. 계산이 헷갈리기 쉬워 예시를 함께 보여준다.
 */
export function SpecialOfferRateForm({ rate, count }: { rate: number; count: number }) {
  const router = useRouter()
  const t = useTranslations("admin")
  const tc = useTranslations("common")
  const [value, setValue] = useState(String(Math.round(rate * 100)))
  const [saving, setSaving] = useState(false)

  const pct = Number(value)
  const current = Number.isFinite(pct) ? pct / 100 : 0

  async function save() {
    if (!Number.isFinite(pct) || pct < 0 || pct > 95) {
      toast.error(t("seasonRateRange"))
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/store-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specialOfferRate: pct / 100 }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(t("saved"))
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">{t("specialOfferRate")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t("specialOfferDesc")}</p>

        <div className="flex items-center gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
            className="h-9 w-20 text-right"
            inputMode="numeric"
          />
          <span className="text-muted-foreground">%</span>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {tc("save")}
          </Button>
          <span className="ml-2 text-sm text-muted-foreground">
            {t("specialOfferCount", { count })}
          </span>
        </div>

        {/* 곱해서 들어가는 값이라 예시가 없으면 감이 안 온다 */}
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-1.5 font-medium">{t("seasonRate")}</th>
                <th className="px-3 py-1.5 text-right font-medium">{t("normalPrice")}</th>
                <th className="px-3 py-1.5 text-right font-medium">{t("specialPrice")}</th>
              </tr>
            </thead>
            <tbody>
              {[0.4, 0.5, 0.6, 0.65].map((s) => (
                <tr key={s} className="border-t">
                  <td className="px-3 py-1.5">{Math.round(s * 100)}%</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {buyerPrice(SAMPLE, s, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                    {buyerPrice(SAMPLE, s, 0, current).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
            {t("seasonRateHint", { sample: SAMPLE.toLocaleString() })}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
