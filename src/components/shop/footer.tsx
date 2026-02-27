import { useTranslations } from "next-intl"

export function ShopFooter() {
  const t = useTranslations("shop")

  return (
    <footer className="border-t bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} {t("logo")}. All rights reserved.</p>
      </div>
    </footer>
  )
}
