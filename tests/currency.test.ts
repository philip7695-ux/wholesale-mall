import { describe, it, expect } from "vitest"
import { convertCurrency } from "@/lib/currency"

// rates: KRW per 1 unit
const rates = { USD: 1380, CNY: 200, JPY: 880 }

describe("convertCurrency", () => {
  it("같은 통화면 그대로", () => {
    expect(convertCurrency(100, "USD", "USD", rates)).toBe(100)
  })

  it("KRW → USD (원 ÷ 환율)", () => {
    expect(convertCurrency(13800, "KRW", "USD", rates)).toBeCloseTo(10)
  })

  it("USD → KRW (달러 × 환율)", () => {
    expect(convertCurrency(10, "USD", "KRW", rates)).toBe(13800)
  })

  it("크로스 통화 USD → CNY (KRW 기준을 거쳐 환산)", () => {
    // 1 USD = 1380 KRW = 1380/200 = 6.9 CNY
    expect(convertCurrency(1, "USD", "CNY", rates)).toBeCloseTo(6.9)
  })

  it("환율이 없는 통화는 1 로 폴백(폭주 방지)", () => {
    // GBP 환율 없음 → fromRate 1
    expect(convertCurrency(100, "GBP", "KRW", rates)).toBe(100)
  })
})
