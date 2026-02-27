"use client"

import { useState } from "react"
import { Link, useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LanguageSelector } from "@/components/language-selector"

export default function RegisterPage() {
  const router = useRouter()
  const t = useTranslations("auth")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      email: formData.get("email"),
      password: formData.get("password"),
      name: formData.get("name"),
      phone: formData.get("phone"),
      businessName: formData.get("businessName"),
      businessNumber: formData.get("businessNumber"),
      businessAddress: formData.get("businessAddress"),
    }

    const confirmPassword = formData.get("confirmPassword")
    if (data.password !== confirmPassword) {
      setError(t("passwordMismatch"))
      setLoading(false)
      return
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    const result = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(result.error)
    } else {
      router.push("/auth/pending")
    }
  }

  return (
    <>
      <div className="absolute right-4 top-4">
        <LanguageSelector />
      </div>
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("registerTitle")}</CardTitle>
          <CardDescription>{t("registerDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{t("name")}</Label>
                <Input id="name" name="name" required placeholder={t("namePlaceholder")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("phone")}</Label>
                <Input id="phone" name="phone" placeholder="010-1234-5678" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("emailRequired")}</Label>
              <Input id="email" name="email" type="email" required placeholder="email@example.com" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">{t("passwordRequired")}</Label>
                <Input id="password" name="password" type="password" required minLength={6} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
                <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={6} />
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="mb-3 text-sm font-medium">{t("businessInfo")}</p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">{t("businessName")}</Label>
                  <Input id="businessName" name="businessName" placeholder={t("businessNamePlaceholder")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessNumber">{t("businessNumber")}</Label>
                  <Input id="businessNumber" name="businessNumber" placeholder="000-00-00000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessAddress">{t("businessAddress")}</Label>
                  <Input id="businessAddress" name="businessAddress" placeholder={t("businessAddressPlaceholder")} />
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("registering") : t("registerButton")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("hasAccount")}{" "}
              <Link href="/auth/login" className="text-primary underline">
                {t("loginTitle")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
