import { getRequestConfig } from "next-intl/server"
import { routing } from "./routing"

const namespaces = [
  "metadata",
  "common",
  "auth",
  "shop",
  "product",
  "cart",
  "order",
  "mypage",
  "admin",
  "error",
  "categories",
  "colors",
  "sizeSpec",
] as const

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale
  }

  const messages: Record<string, any> = {}
  for (const ns of namespaces) {
    messages[ns] = (await import(`../../locales/${locale}/${ns}.json`)).default
  }

  return {
    locale,
    messages,
  }
})
