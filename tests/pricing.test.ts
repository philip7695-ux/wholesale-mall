import { describe, it, expect } from "vitest"
import { totalDiscountRate, buyerPrice, seasonRateFor } from "@/lib/pricing"

describe("totalDiscountRate", () => {
  it("시즌·등급 할인율을 더한다", () => {
    expect(totalDiscountRate(0.5, 0.05)).toBeCloseTo(0.55)
  })
  it("0.95 를 넘지 않도록 막는다(가격이 0 이하가 되면 안 됨)", () => {
    expect(totalDiscountRate(0.9, 0.5)).toBe(0.95)
  })
  it("음수는 0 으로 바닥을 둔다", () => {
    expect(totalDiscountRate(-0.2, 0)).toBe(0)
  })
})

describe("buyerPrice", () => {
  it("택가에 시즌+등급 할인을 적용(더하기)", () => {
    // 10000 × (1 − 0.5 − 0.05) = 4500
    expect(buyerPrice(10000, 0.5, 0.05)).toBe(4500)
  })

  it("스페셜 오퍼는 이미 할인된 값에서 한 번 더 곱해 깎는다", () => {
    // base = 10000 × (1 − 0.5) = 5000, special 30% → 5000 × 0.7 = 3500
    expect(buyerPrice(10000, 0.5, 0, 0.3)).toBe(3500)
  })

  it("소수 둘째 자리까지 반올림", () => {
    // 9900 × (1 − 0.33) = 6633
    expect(buyerPrice(9900, 0.33, 0)).toBe(6633)
  })

  it("할인율이 과해도 최소 5% 가격은 남는다(0.95 상한)", () => {
    // 10000 × (1 − 0.95) = 500
    expect(buyerPrice(10000, 0.9, 0.9)).toBe(500)
  })
})

describe("seasonRateFor", () => {
  const rates = { "63": 0.4, "62": 0.5 }
  it("코드의 시즌키로 할인율을 찾는다", () => {
    // BP63MR108 → 시즌키 63 → 0.4
    expect(seasonRateFor("BP63MR108", rates)).toBe(0.4)
  })
  it("설정 없는 시즌은 0(정상가)", () => {
    expect(seasonRateFor("BP61XX000", rates)).toBe(0)
  })
  it("잘못된/빈 코드는 0", () => {
    expect(seasonRateFor(null, rates)).toBe(0)
    expect(seasonRateFor("XX", rates)).toBe(0)
  })
})
