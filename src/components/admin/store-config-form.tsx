"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

interface StoreConfigData {
  companyName: string
  address: string
  phone: string
  email: string
  footerMessage: string
  footerTerms: string
}

export function StoreConfigForm({ initialConfig }: { initialConfig: StoreConfigData }) {
  const t = useTranslations("admin")
  const [config, setConfig] = useState<StoreConfigData>(initialConfig)
  const [saving, setSaving] = useState(false)

  function update(field: keyof StoreConfigData, value: string) {
    setConfig((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/store-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error()
      toast.success(t("storeConfigSaved"))
    } catch {
      toast.error(t("storeConfigSaveFail"))
    }
    setSaving(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("storeInfoTitle")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("storeInfoDesc")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("storeCompanyName")}</Label>
            <Input
              value={config.companyName}
              onChange={(e) => update("companyName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("storeEmail")}</Label>
            <Input
              value={config.email}
              onChange={(e) => update("email", e.target.value)}
              type="email"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t("storeAddress")}</Label>
          <Input
            value={config.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("storePhone")}</Label>
          <Input
            value={config.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("storeFooterMessage")}</Label>
            <Textarea
              value={config.footerMessage}
              onChange={(e) => update("footerMessage", e.target.value)}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("storeFooterTerms")}</Label>
            <Textarea
              value={config.footerTerms}
              onChange={(e) => update("footerTerms", e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "..." : t("wiseSave")}
        </Button>
      </CardContent>
    </Card>
  )
}
