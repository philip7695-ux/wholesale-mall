import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const intlLocaleMap: Record<string, string> = {
  ko: "ko-KR",
  en: "en-US",
  zh: "zh-CN",
  ja: "ja-JP",
}

const currencySuffix: Record<string, string> = {
  ko: "원",
  zh: "元",
  ja: "円",
}

const currencyPrefix: Record<string, string> = {
  en: "₩",
}

export function formatPrice(price: number, locale: string = "ko"): string {
  const intlLocale = intlLocaleMap[locale] || "ko-KR"
  const number = new Intl.NumberFormat(intlLocale).format(price)
  return (currencyPrefix[locale] || "") + number + (currencySuffix[locale] || "원")
}

export function formatDate(date: Date | string, locale: string = "ko"): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString(intlLocaleMap[locale] || "ko-KR")
}

export function formatDateTime(date: Date | string, locale: string = "ko"): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleString(intlLocaleMap[locale] || "ko-KR")
}

export function generateOrderNumber(): string {
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "")
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `ORD-${datePart}-${randomPart}`
}
