import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LanguageSelector } from "@/components/language-selector"

export default function PendingPage() {
  const t = useTranslations("auth")

  return (
    <>
      <div className="absolute right-4 top-4">
        <LanguageSelector />
      </div>
      <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle className="text-2xl">{t("pendingTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          {t("pendingMessage")}<br />
          {t("pendingDesc")}
        </p>
        <Link href="/auth/login">
          <Button variant="outline">{t("goToLogin")}</Button>
        </Link>
      </CardContent>
    </Card>
    </>
  )
}
