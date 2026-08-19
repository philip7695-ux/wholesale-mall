import { prisma } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"
import { LoginHeroForm } from "@/components/admin/login-hero-form"

export const dynamic = "force-dynamic"

export default async function AppearanceSettingsPage() {
  const t = await getTranslations("admin")

  const config = await prisma.storeConfig
    .findUnique({
      where: { id: "default" },
      select: { loginHeroUrl: true, loginTagline: true, loginTitle: true },
    })
    .catch(() => null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("appearanceSettings")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("appearanceDesc")}</p>
      </div>

      <LoginHeroForm
        initial={{
          loginHeroUrl: config?.loginHeroUrl ?? "",
          loginTagline: config?.loginTagline ?? "Members Only",
          loginTitle: config?.loginTitle ?? "Wholesale Fashion Platform",
        }}
      />
    </div>
  )
}
