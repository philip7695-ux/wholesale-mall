"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Upload, X } from "lucide-react"

interface PaymentSettingData {
  notificationEmail: string
  bankName: string
  accountNumber: string
  accountHolder: string
  bankNote: string
  alipayQrImage: string
  alipayNote: string
  wechatQrImage: string
  wechatNote: string
}

export function PaymentSettingsForm({
  initialData,
}: {
  initialData: PaymentSettingData | null
}) {
  const t = useTranslations("admin")
  const [data, setData] = useState<PaymentSettingData>({
    notificationEmail: initialData?.notificationEmail || "",
    bankName: initialData?.bankName || "",
    accountNumber: initialData?.accountNumber || "",
    accountHolder: initialData?.accountHolder || "",
    bankNote: initialData?.bankNote || "",
    alipayQrImage: initialData?.alipayQrImage || "",
    alipayNote: initialData?.alipayNote || "",
    wechatQrImage: initialData?.wechatQrImage || "",
    wechatNote: initialData?.wechatNote || "",
  })
  const [saving, setSaving] = useState(false)
  const [uploadingField, setUploadingField] = useState<string | null>(null)

  function update(field: keyof PaymentSettingData, value: string) {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleQrUpload(field: "alipayQrImage" | "wechatQrImage", e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingField(field)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", "payment")

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) throw new Error()

      const { url } = await res.json()
      update(field, url)
      toast.success(t("paymentQrUploaded"))
    } catch {
      toast.error(t("paymentQrUploadFail"))
    }
    setUploadingField(null)
    e.target.value = ""
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings/payment", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error()
      toast.success(t("paymentSettingsSaved"))
    } catch {
      toast.error(t("paymentSettingsSaveFail"))
    }
    setSaving(false)
  }

  function QrUploadBlock({ field, label, alt }: { field: "alipayQrImage" | "wechatQrImage"; label: string; alt: string }) {
    const image = data[field]
    const isUploading = uploadingField === field
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        {image ? (
          <div className="relative inline-block">
            <img src={image} alt={alt} className="h-48 w-48 rounded-lg border object-contain" />
            <button
              type="button"
              onClick={() => update(field, "")}
              className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <label className="flex h-48 w-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed hover:border-primary">
            <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {isUploading ? t("uploading") : t("paymentUploadQr")}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleQrUpload(field, e)}
              className="hidden"
              disabled={isUploading}
            />
          </label>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 알림 이메일 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("paymentNotificationTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>{t("paymentNotificationEmail")}</Label>
          <Input
            type="email"
            value={data.notificationEmail}
            onChange={(e) => update("notificationEmail", e.target.value)}
            placeholder={t("paymentNotificationEmailPlaceholder")}
          />
          <p className="text-xs text-muted-foreground">{t("paymentNotificationEmailHint")}</p>
        </CardContent>
      </Card>

      {/* 계좌이체 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("paymentBankTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("paymentBankName")}</Label>
              <Input
                value={data.bankName}
                onChange={(e) => update("bankName", e.target.value)}
                placeholder={t("paymentBankNamePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("paymentAccountHolder")}</Label>
              <Input
                value={data.accountHolder}
                onChange={(e) => update("accountHolder", e.target.value)}
                placeholder={t("paymentAccountHolderPlaceholder")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("paymentAccountNumber")}</Label>
            <Input
              value={data.accountNumber}
              onChange={(e) => update("accountNumber", e.target.value)}
              placeholder={t("paymentAccountNumberPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("paymentBankNote")}</Label>
            <Textarea
              value={data.bankNote}
              onChange={(e) => update("bankNote", e.target.value)}
              placeholder={t("paymentBankNotePlaceholder")}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* QR코드 결제 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("paymentQrTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* 알리페이 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">{t("paymentAlipayTitle")}</h3>
              <QrUploadBlock field="alipayQrImage" label={t("paymentAlipayQr")} alt="Alipay QR" />
              <div className="space-y-2">
                <Label>{t("paymentAlipayNote")}</Label>
                <Textarea
                  value={data.alipayNote}
                  onChange={(e) => update("alipayNote", e.target.value)}
                  placeholder={t("paymentAlipayNotePlaceholder")}
                  rows={2}
                />
              </div>
            </div>

            {/* 위챗페이 */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">{t("paymentWechatTitle")}</h3>
              <QrUploadBlock field="wechatQrImage" label={t("paymentWechatQr")} alt="WeChat QR" />
              <div className="space-y-2">
                <Label>{t("paymentWechatNote")}</Label>
                <Textarea
                  value={data.wechatNote}
                  onChange={(e) => update("wechatNote", e.target.value)}
                  placeholder={t("paymentWechatNotePlaceholder")}
                  rows={2}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? t("orderSaving") : t("rateSaveButton")}
        </Button>
      </div>
    </div>
  )
}
