"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, Loader2, X } from "lucide-react"
import { downscaleForUpload } from "@/lib/downscale"

type Config = {
  loginHeroUrl: string
  loginTagline: string
  loginTitle: string
}

/** 로그인 화면 좌측 대문(이미지 + 문구) 설정. */
export function LoginHeroForm({ initial }: { initial: Config }) {
  const router = useRouter()
  const t = useTranslations("admin")
  const tc = useTranslations("common")
  const [form, setForm] = useState<Config>(initial)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      // 대문은 크게 쓰이므로 원본을 그대로 보내면 용량 한도에 걸린다
      const prepared = await downscaleForUpload(file)
      const fd = new FormData()
      fd.append("file", prepared)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm((f) => ({ ...f, loginHeroUrl: data.url }))
    } catch (err: any) {
      toast.error(err?.message || t("uploadFailed"))
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/store-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(t("saved"))
      router.refresh()
    } catch (err: any) {
      toast.error(err?.message || t("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  const preview = form.loginHeroUrl || "/images/login-hero.jpg"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium">{t("loginHero")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* 실제 로그인 화면과 같은 비율·문구 배치로 보여준다 */}
        <div className="relative aspect-[3/4] w-full max-w-xs overflow-hidden rounded-lg bg-muted sm:aspect-[4/5]">
          <img src={preview} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute bottom-5 left-5 right-5">
            <p className="text-[10px] font-light uppercase tracking-[0.3em] text-white/70">
              {form.loginTagline}
            </p>
            <h2 className="mt-1 whitespace-pre-line text-xl font-light leading-tight tracking-tight text-white">
              {form.loginTitle}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label>
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            <Button asChild variant="outline" size="sm" disabled={uploading}>
              <span className="cursor-pointer">
                {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {t("changeImage")}
              </span>
            </Button>
          </label>
          {form.loginHeroUrl && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setForm((f) => ({ ...f, loginHeroUrl: "" }))}
            >
              <X className="mr-1 h-3 w-3" />
              {t("useDefaultImage")}
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tagline">{t("loginTagline")}</Label>
          <Input
            id="tagline"
            value={form.loginTagline}
            onChange={(e) => setForm((f) => ({ ...f, loginTagline: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">{t("loginTitle")}</Label>
          <Input
            id="title"
            value={form.loginTitle}
            onChange={(e) => setForm((f) => ({ ...f, loginTitle: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">{t("loginTitleHint")}</p>
        </div>

        <Button onClick={save} disabled={saving || uploading}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tc("save")}
        </Button>
      </CardContent>
    </Card>
  )
}
