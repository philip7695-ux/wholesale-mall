import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatCurrency, getCurrencyForLocale } from "@/lib/currency"

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

export function formatPrice(priceKRW: number, locale: string = "ko", rate?: number): string {
  if (rate !== undefined && rate > 0) {
    const currency = getCurrencyForLocale(locale)
    return formatCurrency(priceKRW, currency, rate)
  }
  // 기존 동작: KRW 그대로 표시 (관리자 페이지용)
  const intlLocale = intlLocaleMap[locale] || "ko-KR"
  const number = new Intl.NumberFormat(intlLocale).format(priceKRW)
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

export function generateInvoiceNumber(): string {
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "")
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `INV-${datePart}-${randomPart}`
}
