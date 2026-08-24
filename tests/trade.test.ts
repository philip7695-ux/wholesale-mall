import { describe, it, expect } from "vitest"
import { applyVat, resolveTradeTerms, VAT_RATE } from "@/lib/trade"

describe("applyVat", () => {
  it("국내 부가세 10% 를 공급가에 더한다", () => {
    const r = applyVat(10000, 0.1)
    expect(r.supplyAmount).toBe(10000)
    expect(r.vatAmount).toBe(1000)
    expect(r.totalAmount).toBe(11000)
  })

  it("영세율(0%)이면 세액 0, 총액=공급가", () => {
    const r = applyVat(52340, 0)
    expect(r.vatAmount).toBe(0)
    expect(r.totalAmount).toBe(52340)
  })

  it("소수 둘째 자리까지 반올림한다", () => {
    const r = applyVat(24.225, 0.1)
    // 24.225 * 0.1 = 2.4225 → 2.42
    expect(r.vatAmount).toBe(2.42)
    expect(r.supplyAmount).toBe(24.23) // 24.225 → 24.23
  })

  it("VAT_RATE 상수는 0.1", () => {
    expect(VAT_RATE).toBe(0.1)
  })
})

describe("resolveTradeTerms", () => {
  it("국내 거래는 KRW + 10%", () => {
    expect(resolveTradeTerms({ tradeType: "DOMESTIC" }, "en")).toEqual({
      currency: "KRW",
      vatRate: 0.1,
    })
  })

  it("수출은 영세율 + 지정 통화 우선", () => {
    expect(resolveTradeTerms({ tradeType: "EXPORT", currency: "CNY" }, "en")).toEqual({
      currency: "CNY",
      vatRate: 0,
    })
  })

  it("수출인데 통화 미지정이면 접속 언어 기본 통화", () => {
    expect(resolveTradeTerms({ tradeType: "EXPORT" }, "ja")).toEqual({
      currency: "JPY",
      vatRate: 0,
    })
  })

  it("정보 없으면 국내로 간주(KRW+10%)", () => {
    expect(resolveTradeTerms(null, "ko")).toEqual({ currency: "KRW", vatRate: 0.1 })
  })
})
