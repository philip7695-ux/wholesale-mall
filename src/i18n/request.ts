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
  "api",
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
    onError(error) {
      // 번역 키 없을 때 에러 대신 경고만 출력
      if (process.env.NODE_ENV !== "production") {
        console.warn(error.message)
      }
    },
    getMessageFallback({ key }: { namespace?: string; key: string; error: Error }) {
      // 마지막 키 부분(slug)을 그대로 반환
      return key.split(".").at(-1) ?? key
    },
  }
})
