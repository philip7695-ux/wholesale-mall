"use client"

import { useState } from "react"
import { signIn, getSession } from "next-auth/react"
import { Link, useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LanguageSelector } from "@/components/language-selector"

export default function LoginPage() {
  const router = useRouter()
  const t = useTranslations("auth")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError(t("loginError"))
    } else {
      // 세션을 가져와서 role 확인 (재시도 포함)
      let role = ""
      for (let i = 0; i < 3; i++) {
        const session = await getSession()
        if (session?.user?.role) {
          role = session.user.role
          break
        }
        await new Promise(r => setTimeout(r, 500))
      }
      router.refresh()
      if (role === "ADMIN") {
        router.replace("/admin")
      } else {
        router.replace("/")
      }
    }
  }

  return (
    <>
      <div className="absolute right-4 top-4">
        <LanguageSelector />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("loginTitle")}</CardTitle>
          <CardDescription>{t("loginDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder={t("passwordPlaceholder")}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("loggingIn") : t("loginButton")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              {t("noAccount")}{" "}
              <Link href="/auth/register" className="text-primary underline">
                {t("register")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
