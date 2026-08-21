"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Mail, Send } from "lucide-react"

/**
 * 주문·인보이스·출하 알림을 받을 관리자 이메일과 발송 테스트.
 * 여기서 테스트가 성공해야 실제 알림도 나간다.
 */
export function EmailNotificationCard() {
  const t = useTranslations("admin")
  const [email, setEmail] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    fetch("/api/admin/notification-email")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setEmail(d.notificationEmail || ""))
      .finally(() => setLoaded(true))
  }, [])

  async function save() {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/notification-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationEmail: email }),
      })
      if (!res.ok) throw new Error()
      toast.success(t("emailNotifSaved"))
    } catch {
      toast.error(t("emailNotifSaveFail"))
    } finally {
      setSaving(false)
    }
  }

  async function sendTest() {
    setTesting(true)
    try {
      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email.trim() || undefined }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      toast.success(t("paymentTestSent", { to: d.to }))
    } catch (e: any) {
      toast.error(e?.message || t("paymentTestFail"))
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" />
          {t("emailNotifTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Label>{t("emailNotifEmail")}</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@biibws.com"
          disabled={!loaded}
        />
        <p className="text-xs text-muted-foreground">{t("emailNotifHint")}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={save} disabled={saving || !loaded}>
            {saving ? t("orderSaving") : t("rateSaveButton")}
          </Button>
          <Button size="sm" variant="outline" onClick={sendTest} disabled={testing || !loaded}>
            <Send className="mr-1 h-3.5 w-3.5" />
            {testing ? t("paymentTestSending") : t("paymentTestButton")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
