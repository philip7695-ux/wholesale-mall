import { describe, it, expect } from "vitest"
import { checkMoq, type MoqCheckInput } from "@/lib/moq"
import { getEffectiveMoq } from "@/lib/grade"

describe("getEffectiveMoq (등급별 MOQ 완화)", () => {
  it("BRONZE/SILVER 는 그대로", () => {
    expect(getEffectiveMoq(30, "BRONZE")).toBe(30)
  })
  it("GOLD/VIP 는 절반(올림)", () => {
    expect(getEffectiveMoq(30, "GOLD")).toBe(15)
    expect(getEffectiveMoq(31, "VIP")).toBe(16) // ceil(15.5)
  })
  it("MOQ 0 이면 제한 없음", () => {
    expect(getEffectiveMoq(0, "BRONZE")).toBe(0)
  })
})

function baseInput(over: Partial<MoqCheckInput> = {}): MoqCheckInput {
  return {
    productMoq: 30,
    colorMoq: 10,
    colors: [
      { colorId: "red", colorName: "Red", moq: 0 },
      { colorId: "blue", colorName: "Blue", moq: 20 },
    ],
    quantities: { red: 20, blue: 20 },
    grade: "BRONZE",
    ...over,
  }
}

describe("checkMoq", () => {
  it("상품·색상 MOQ 모두 충족하면 valid", () => {
    const r = checkMoq(baseInput())
    expect(r.valid).toBe(true)
    expect(r.productQtyTotal).toBe(40)
    expect(r.colorErrors).toHaveLength(0)
  })

  it("상품 총수량이 MOQ 미달이면 invalid", () => {
    const r = checkMoq(baseInput({ quantities: { red: 10, blue: 0 } }))
    expect(r.valid).toBe(false)
    expect(r.productMoqRequired).toBe(30)
    expect(r.productQtyTotal).toBe(10)
  })

  it("색상 개별 MOQ 미달을 색상별로 보고한다", () => {
    // blue MOQ 20 인데 5장만 → 색상 에러
    const r = checkMoq(baseInput({ quantities: { red: 30, blue: 5 } }))
    expect(r.valid).toBe(false)
    expect(r.colorErrors).toHaveLength(1)
    expect(r.colorErrors[0]).toMatchObject({ colorId: "blue", required: 20, actual: 5 })
  })

  it("선택하지 않은(0장) 색상은 MOQ 검사에서 제외", () => {
    const r = checkMoq(baseInput({ quantities: { red: 30, blue: 0 } }))
    expect(r.colorErrors).toHaveLength(0)
    expect(r.valid).toBe(true)
  })

  it("색상 개별 MOQ 가 0 이면 상품 colorMoq(10) 로 폴백", () => {
    // red 는 moq 0 → colorMoq 10 적용, 5장이면 미달
    const r = checkMoq(baseInput({ quantities: { red: 5, blue: 20 }, productMoq: 0 }))
    expect(r.colorErrors.map((e) => e.colorId)).toContain("red")
  })

  it("GOLD 등급은 상품 MOQ 가 절반으로 완화", () => {
    // productMoq 30 → GOLD 15, 총 20장이면 충족
    const r = checkMoq(baseInput({ grade: "GOLD", quantities: { red: 20, blue: 0 } }))
    expect(r.productMoqRequired).toBe(15)
    expect(r.valid).toBe(true)
  })
})
