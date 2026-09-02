import { describe, it, expect } from "vitest"
import { gs1ColorCode, gs1SizeCode, gs1CountryCode, gs1ImportFlag, GS1_CATEGORY_CODES } from "../src/lib/gs1"

describe("gs1ColorCode", () => {
  it("영문 색상명을 코드로 변환한다", () => {
    expect(gs1ColorCode("Black")).toBe("093009")
    expect(gs1ColorCode("IVORY")).toBe("093042")
    expect(gs1ColorCode("oatmeal")).toBe("093058")
  })
  it("별칭(Gray, Multi 등)을 처리한다", () => {
    expect(gs1ColorCode("Gray")).toBe("093035")
    expect(gs1ColorCode("Multi")).toBe("093109")
  })
  it("코드표에 없으면 null", () => {
    expect(gs1ColorCode("Sunset Orange")).toBeNull()
  })
})

describe("gs1SizeCode", () => {
  it("BABY는 유아의류 표를 먼저 본다", () => {
    expect(gs1SizeCode("85", "BABY")).toBe("006006")
    expect(gs1SizeCode("12M", "NEWBORN")).toBe("006016")
    // 140은 유아 표에 없으니 아동 표로 넘어간다
    expect(gs1SizeCode("140", "BABY")).toBe("007005")
  })
  it("KIDS는 아동의류 표를 먼저 본다", () => {
    expect(gs1SizeCode("100", "KIDS")).toBe("007001")
    expect(gs1SizeCode("S", "KIDS")).toBe("007010")
    // 65는 아동 표에 없으니 유아 표로 넘어간다
    expect(gs1SizeCode("65", "KIDS")).toBe("006023")
  })
  it("F는 FREE로 취급한다", () => {
    expect(gs1SizeCode("F", "KIDS")).toBe("007013")
    expect(gs1SizeCode("Free", "BABY")).toBe("006022")
  })
  it("나이 사이즈(8Y)는 변환하지 않는다", () => {
    expect(gs1SizeCode("8Y", "KIDS")).toBeNull()
  })
})

describe("gs1CountryCode / gs1ImportFlag", () => {
  it("국가명·키워드를 ISO 코드로 변환한다", () => {
    expect(gs1CountryCode("KR")).toBe("KR")
    expect(gs1CountryCode("중국")).toBe("CN")
    expect(gs1CountryCode("Made in Vietnam")).toBe("VN")
    expect(gs1CountryCode("인도네시아")).toBe("ID")
    expect(gs1CountryCode(null)).toBeNull()
    expect(gs1CountryCode("알 수 없음")).toBeNull()
  })
  it("수입여부: KR=1, 그 외=2, 모름=빈칸", () => {
    expect(gs1ImportFlag("KR")).toBe("1")
    expect(gs1ImportFlag("CN")).toBe("2")
    expect(gs1ImportFlag(null)).toBe("")
  })
})

describe("GS1_CATEGORY_CODES", () => {
  it("모든 코드는 8자리 숫자다", () => {
    for (const code of Object.values(GS1_CATEGORY_CODES)) {
      expect(code).toMatch(/^\d{8}$/)
    }
  })
})
