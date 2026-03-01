import { useTranslations } from "next-intl"

export function ShopFooter() {
  const t = useTranslations("shop")

  return (
    <footer className="border-t bg-white py-10">
      <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} {t("logo")}. All rights reserved.</p>
      </div>
    </footer>
  )
}
