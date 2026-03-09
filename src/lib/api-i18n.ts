import { routing } from "@/i18n/routing"
import { cookies } from "next/headers"

type Locale = (typeof routing.locales)[number]

const messageCache: Partial<Record<string, Record<string, string>>> = {}

async function loadMessages(locale: string, namespace: string): Promise<Record<string, string>> {
  const key = `${locale}/${namespace}`
  if (messageCache[key]) return messageCache[key]!
  const messages = (await import(`../../locales/${locale}/${namespace}.json`)).default
  messageCache[key] = messages
  return messages
}

/**
 * Get the current locale from the request.
 * Checks: X-Locale header → NEXT_LOCALE cookie → Accept-Language → default
 */
export async function getApiLocale(request?: Request): Promise<Locale> {
  // 1. Check X-Locale header
  if (request) {
    const headerLocale = request.headers.get("X-Locale")
    if (headerLocale && routing.locales.includes(headerLocale as Locale)) {
      return headerLocale as Locale
    }
  }

  // 2. Check NEXT_LOCALE cookie (set by next-intl)
  try {
    const cookieStore = await cookies()
    const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value
    if (cookieLocale && routing.locales.includes(cookieLocale as Locale)) {
      return cookieLocale as Locale
    }
  } catch {
    // cookies() may fail in some contexts
  }

  // 3. Check Accept-Language header
  if (request) {
    const acceptLang = request.headers.get("Accept-Language") || ""
    for (const locale of routing.locales) {
      if (acceptLang.startsWith(locale)) {
        return locale
      }
    }
  }

  return routing.defaultLocale as Locale
}

/**
 * Get a translation function for use in API routes.
 */
export async function getApiTranslations(
  request: Request | undefined,
  namespace: string
): Promise<(key: string, params?: Record<string, string | number>) => string> {
  const locale = await getApiLocale(request)
  const messages = await loadMessages(locale, namespace)

  return function t(key: string, params?: Record<string, string | number>): string {
    let value = messages[key] || key
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(`{${k}}`, String(v))
      }
    }
    return value
  }
}
