"use client"

import { useLocale } from "next-intl"
import { usePathname, useRouter } from "@/i18n/navigation"
import { locales, localeNames, localeFlags, type Locale } from "@/i18n/config"

export function LanguageSelector({ className }: { className?: string }) {
  const currentLocale = useLocale() as Locale
  const pathname = usePathname()
  const router = useRouter()

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.replace(pathname, { locale: e.target.value as Locale })
  }

  return (
    <select
      value={currentLocale}
      onChange={handleChange}
      className={`rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${className ?? ""}`}
    >
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {localeFlags[locale]} {localeNames[locale]}
        </option>
      ))}
    </select>
  )
}
