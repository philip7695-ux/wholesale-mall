import { describe, it, expect } from "vitest"
import { seasonKeyFromCode, seasonIndex, isNewSeason } from "@/lib/season"

describe("seasonKeyFromCode", () => {
  it("코드 3~4번째 자리를 시즌키로 뽑는다", () => {
    expect(seasonKeyFromCode("BP63MR108")).toBe("63") // 2026 FW
    expect(seasonKeyFromCode("BU52AA001")).toBe("52") // 2025 SU
  })
  it("형식에 안 맞으면 null", () => {
    expect(seasonKeyFromCode("BP00XX")).toBe(null) // 00 은 유효 범위 아님
    expect(seasonKeyFromCode("")).toBe(null)
    expect(seasonKeyFromCode(null)).toBe(null)
  })
})

describe("seasonIndex", () => {
  it("연·시즌을 단조 증가 인덱스로 변환", () => {
    // (2020+6)*4 + 3 = 8107
    expect(seasonIndex("63")).toBe(8107)
    // (2020+5)*4 + 2 = 8102
    expect(seasonIndex("52")).toBe(8102)
    expect(seasonIndex("63")! > seasonIndex("52")!).toBe(true)
  })
  it("잘못된 키는 null", () => {
    expect(seasonIndex("99")).toBe(null)
    expect(seasonIndex(null)).toBe(null)
  })
})

describe("isNewSeason (품번 기준 신상 판정)", () => {
  // 2026-08(가을 시즌=4분기 이전, 현재 시즌 인덱스 = 2026*4+3 = 8107)
  const now = new Date("2026-08-24T00:00:00Z")
  it("현재 시즌 이후면 신상", () => {
    expect(isNewSeason("63", now)).toBe(true) // 2026 FW = 8107 >= 8107
    expect(isNewSeason("64", now)).toBe(true) // 2026 WI = 8108 (그 이후)
  })
  it("현재보다 오래된 시즌은 재고", () => {
    expect(isNewSeason("62", now)).toBe(false) // 2026 SU = 8106 < 8107
    expect(isNewSeason("53", now)).toBe(false) // 2025 FW
  })
})
