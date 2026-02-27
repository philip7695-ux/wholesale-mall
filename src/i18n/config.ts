export const locales = ["ko", "en", "zh", "ja"] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = "ko"

export const localeNames: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
  zh: "中文",
  ja: "日本語",
}

export const localeFlags: Record<Locale, string> = {
  ko: "🇰🇷",
  en: "🇺🇸",
  zh: "🇨🇳",
  ja: "🇯🇵",
}
