"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

export default function NewMemberPage() {
  const router = useRouter()
  const t = useTranslations("admin")
  const ta = useTranslations("auth")
  const tc = useTranslations("common")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const password = formData.get("password") as string
    const confirmPassword = formData.get("confirmPassword") as string

    if (password !== confirmPassword) {
      toast.error(ta("passwordMismatch"))
      setLoading(false)
      return
    }

    const data = {
      email: formData.get("email"),
      password,
      name: formData.get("name"),
      phone: formData.get("phone"),
      businessName: formData.get("businessName"),
      businessNumber: formData.get("businessNumber"),
      businessAddress: formData.get("businessAddress"),
      role: formData.get("role") || "BUYER",
      approvalStatus: formData.get("approvalStatus") || "APPROVED",
    }

    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error)
      }

      toast.success(t("memberRegistered"))
      router.push("/admin/members")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc("error"))
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("addMemberTitle")}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("basicInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{ta("name")}</Label>
                <Input id="name" name="name" required placeholder={ta("namePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{ta("emailRequired")}</Label>
                <Input id="email" name="email" type="email" required placeholder="email@example.com" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">{ta("passwordRequired")}</Label>
                <Input id="password" name="password" type="password" required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{ta("confirmPassword")}</Label>
                <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={6} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">{ta("phone")}</Label>
                <Input id="phone" name="phone" placeholder="010-1234-5678" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">{t("role")}</Label>
                <Select name="role" defaultValue="BUYER">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUYER">{t("buyer")}</SelectItem>
                    <SelectItem value="ADMIN">{t("adminRole")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="approvalStatus">{t("approvalStatus")}</Label>
              <Select name="approvalStatus" defaultValue="APPROVED">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APPROVED">{t("approve")}</SelectItem>
                  <SelectItem value="PENDING">{t("approvalPending")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{ta("businessInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="businessName">{ta("businessName")}</Label>
                <Input id="businessName" name="businessName" placeholder={ta("businessNamePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessNumber">{ta("businessNumber")}</Label>
                <Input id="businessNumber" name="businessNumber" placeholder="000-00-00000" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessAddress">{ta("businessAddress")}</Label>
              <Input id="businessAddress" name="businessAddress" placeholder={ta("businessAddressPlaceholder")} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? t("registeringMember") : t("addMember")}
          </Button>
        </div>
      </form>
    </div>
  )
}
