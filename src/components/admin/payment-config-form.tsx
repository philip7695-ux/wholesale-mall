"use client"

import { useState, useRef } from "react"
import { DropZone } from "@/components/ui/drop-zone"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Upload } from "lucide-react"

interface PaymentConfigData {
  method: string
  enabled: boolean
  accountName: string
  accountInfo: string
  bankName: string
  qrCodeUrl: string
  memo: string
}

const METHODS = ["BANK_TRANSFER", "BANK_TRANSFER_FOREIGN", "ALIPAY", "WECHAT"] as const

function getDefault(method: string): PaymentConfigData {
  return { method, enabled: false, accountName: "", accountInfo: "", bankName: "", qrCodeUrl: "", memo: "" }
}

export function PaymentConfigForm({ initialConfigs }: { initialConfigs: PaymentConfigData[] }) {
  const t = useTranslations("admin")
  const [configs, setConfigs] = useState<Record<string, PaymentConfigData>>(() => {
    const map: Record<string, PaymentConfigData> = {}
    for (const m of METHODS) {
      const existing = initialConfigs.find((c) => c.method === m)
      map[m] = existing || getDefault(m)
    }
    return map
  })
  const [saving, setSaving] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const methodLabels: Record<string, string> = {
    BANK_TRANSFER: t("paymentMethodBankTransfer"),
    BANK_TRANSFER_FOREIGN: t("paymentMethodBankTransferForeign"),
    ALIPAY: t("paymentMethodAlipay"),
    WECHAT: t("paymentMethodWechat"),
  }

  function updateConfig(method: string, field: keyof PaymentConfigData, value: string | boolean) {
    setConfigs((prev) => ({
      ...prev,
      [method]: { ...prev[method], [field]: value },
    }))
  }

  async function handleQrUpload(method: string, file: File) {
    setUploading(method)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "qrcode")
      const res = await fetch("/api/upload", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      updateConfig(method, "qrCodeUrl", data.url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    }
    setUploading(null)
  }

  async function handleSave(method: string) {
    setSaving(method)
    try {
      const res = await fetch("/api/admin/payment-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configs[method]),
      })
      if (!res.ok) throw new Error()
      toast.success(t("paymentConfigSaved"))
    } catch {
      toast.error(t("paymentConfigSaveFail"))
    }
    setSaving(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t("paymentSettingsTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("paymentSettingsDesc")}</p>
      </div>

      {METHODS.map((method) => {
        const config = configs[method]
        return (
          <Card key={method}>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{methodLabels[method]}</CardTitle>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => updateConfig(method, "enabled", e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                  {t("paymentEnabled")}
                </label>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {/* 은행명·예금주·계좌번호를 한 줄에. 계좌이체만 은행명이 있다. */}
              <div
                className={`grid gap-3 sm:grid-cols-2 ${
                  method.startsWith("BANK_TRANSFER") ? "lg:grid-cols-3" : ""
                }`}
              >
                {method.startsWith("BANK_TRANSFER") && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{t("paymentBankName")}</Label>
                    <Input
                      value={config.bankName}
                      onChange={(e) => updateConfig(method, "bankName", e.target.value)}
                      placeholder="국민은행, HSBC, etc."
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("paymentAccountName")}</Label>
                  <Input
                    value={config.accountName}
                    onChange={(e) => updateConfig(method, "accountName", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{t("paymentAccountInfo")}</Label>
                  <Input
                    value={config.accountInfo}
                    onChange={(e) => updateConfig(method, "accountInfo", e.target.value)}
                    placeholder={method.startsWith("BANK_TRANSFER") ? "000-000000-00-000" : "account@example.com"}
                  />
                </div>
              </div>

              {/* QR 은 Alipay·WeChat 만 쓴다. 계좌이체엔 자리만 잡아 지저분하다. */}
              {(method === "ALIPAY" || method === "WECHAT") && (
                <div className="flex items-center gap-3">
                  <input
                    ref={(el) => { fileRefs.current[method] = el }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleQrUpload(method, file)
                    }}
                  />
                  <DropZone
                    accept="image/*"
                    disabled={uploading === method}
                    onFiles={(f) => f[0] && handleQrUpload(method, f[0])}
                    overlayText={t("paymentQrDrop")}
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileRefs.current[method]?.click()}
                      disabled={uploading === method}
                    >
                      <Upload className="mr-1 h-4 w-4" />
                      {uploading === method ? "..." : t("paymentQrUpload")}
                    </Button>
                  </DropZone>
                  {config.qrCodeUrl && (
                    <img
                      src={config.qrCodeUrl}
                      alt="QR Code"
                      className="h-14 w-14 rounded border object-contain"
                    />
                  )}
                </div>
              )}

              {/* 추가 안내: 있을 때만 크게, 기본은 한 줄 */}
              <Input
                value={config.memo}
                onChange={(e) => updateConfig(method, "memo", e.target.value)}
                placeholder={t("paymentMemoPlaceholder")}
              />

              <Button
                onClick={() => handleSave(method)}
                disabled={saving === method}
              >
                {saving === method ? "..." : t("wiseSave")}
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
