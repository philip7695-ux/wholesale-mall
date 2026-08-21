/**
 * 상품 연령대. 화면 필터와 서버 조회가 같은 목록을 봐야
 * 한쪽에만 뉴본이 빠지는 일이 생기지 않는다.
 */
export const AGE_GROUPS = ["NEWBORN", "BABY", "KIDS", "ADULT"] as const

export type AgeGroupValue = (typeof AGE_GROUPS)[number]

/** shop 네임스페이스의 번역 키 */
export const AGE_GROUP_KEYS: Record<AgeGroupValue, string> = {
  NEWBORN: "newborn",
  BABY: "baby",
  KIDS: "kids",
  ADULT: "adult",
}

export function isAgeGroup(v: unknown): v is AgeGroupValue {
  return typeof v === "string" && (AGE_GROUPS as readonly string[]).includes(v)
}
