import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  const t = useTranslations("shop")

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="flex flex-col items-center gap-4 py-12 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">{t("heroTitle")}</h1>
        <p className="max-w-md text-muted-foreground">
          {t("heroDesc1")}<br />
          {t("heroDesc2")}
        </p>
        <Link href="/products">
          <Button size="lg">{t("browseProducts")}</Button>
        </Link>
      </section>
    </div>
  )
}
