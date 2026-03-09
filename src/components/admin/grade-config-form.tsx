"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

interface GradeConfig {
  grade: string
  discountRate: number
  moqRate: number
  threshold: number
}

const GRADE_LABELS: Record<string, { emoji: string }> = {
  BRONZE: { emoji: "🥉" },
  SILVER: { emoji: "🥈" },
  GOLD: { emoji: "🥇" },
  VIP: { emoji: "💎" },
}

export function GradeConfigForm({
  initialConfigs,
}: {
  initialConfigs: GradeConfig[]
}) {
  const t = useTranslations("admin")
  const [configs, setConfigs] = useState<GradeConfig[]>(initialConfigs)
  const [saving, setSaving] = useState(false)

  function updateConfig(grade: string, field: keyof GradeConfig, value: string) {
    setConfigs((prev) =>
      prev.map((c) =>
        c.grade === grade
          ? { ...c, [field]: field === "threshold" ? parseInt(value) || 0 : parseFloat(value) || 0 }
          : c
      )
    )
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings/grades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grades: configs }),
      })
      if (!res.ok) throw new Error()
      toast.success(t("gradeSettingsSaved"))
    } catch {
      toast.error(t("gradeSettingsSaveFail"))
    }
    setSaving(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("gradeSettingsLabel")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Header */}
          <div className="hidden sm:grid sm:grid-cols-[140px_1fr_1fr_1fr] gap-4 text-sm font-medium text-muted-foreground">
            <span>{t("gradeLabel")}</span>
            <span>{t("gradeDiscount")}</span>
            <span>{t("gradeMoqRate")}</span>
            <span>{t("gradeThreshold")}</span>
          </div>

          {configs.map((config) => {
            const label = GRADE_LABELS[config.grade]
            return (
              <div
                key={config.grade}
                className="grid grid-cols-1 gap-3 sm:grid-cols-[140px_1fr_1fr_1fr] sm:gap-4 sm:items-center border-b pb-4 last:border-b-0 last:pb-0"
              >
                <span className="text-sm font-medium">
                  {label?.emoji} {config.grade}
                </span>

                <div>
                  <label className="text-xs text-muted-foreground sm:hidden">{t("gradeDiscount")}</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(config.discountRate * 100)}
                      onChange={(e) =>
                        updateConfig(config.grade, "discountRate", String(parseFloat(e.target.value) / 100))
                      }
                      className="h-9 w-24 text-right"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground sm:hidden">{t("gradeMoqRate")}</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(config.moqRate * 100)}
                      onChange={(e) =>
                        updateConfig(config.grade, "moqRate", String(parseFloat(e.target.value) / 100))
                      }
                      className="h-9 w-24 text-right"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground sm:hidden">{t("gradeThreshold")}</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min={0}
                      step={1000}
                      value={config.threshold}
                      onChange={(e) => updateConfig(config.grade, "threshold", e.target.value)}
                      className="h-9 w-32 text-right"
                    />
                  </div>
                </div>
              </div>
            )
          })}

          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("orderSaving") : t("rateSaveButton")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
