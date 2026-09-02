/**
 * 코리안넷(GS1 Korea) 대량등록 엑셀 변환 규칙.
 *
 * 코리안넷 업로드 템플릿은 색상·사이즈·분류를 자유 입력이 아니라
 * 고정 코드표로만 받는다. 여기 상수들은 그 코드표(bulk_product_insert
 * 템플릿의 참조 시트)를 그대로 옮긴 것이다 — 임의로 고치면 업로드가
 * 반려되므로 코리안넷 템플릿이 바뀔 때만 갱신할 것.
 */

/** 몰 카테고리 slug → GS1 상품분류코드(8자리). 유아동 브랜드 기준. */
export const GS1_CATEGORY_CODES: Record<string, string> = {
  outer: "09020103", // 유아동의류-재킷
  tops: "09020109", // 유아동의류-티셔츠
  bottoms: "09020110", // 유아동의류-바지
  dresses: "09020115", // 유아동의류-원피스
  sets: "09068801", // 의류세트류
  allinone: "09020199", // 기타유아동의류
  innerwear: "09070303", // 유아동/주니어내의
  swimwear: "10140499", // 기타수영복
  accessories: "11140103", // 유아동액세서리
  hats: "11101099", // 기타 모자
  socks: "11150301", // 유아동주니어양말
  bags: "11140102", // 유아동가방
}

/** GS1 색상코드. 코드표의 영문 색상명(대문자) → 코드. */
export const GS1_COLOR_CODES: Record<string, string> = {
  APRICOT: "093001", AQUA: "093002", "AQUA(L)": "093003", BEIGE: "093004",
  "BEIGE(D)": "093005", "BEIGE(L)": "093006", "BLACK(L)": "093007", "BLACK(P)": "093008",
  BLACK: "093009", "BLACK(D)": "093010", BLUE: "093011", "BLUE(D)": "093012",
  "BLUE(L)": "093013", "BLUE(P)": "093014", BROWN: "093015", "BROWN(D)": "093016",
  "BROWN(L)": "093017", "BROWN(P)": "093018", CHARCOAL: "093019", COFFEE: "093020",
  "COFFEE(D)": "093021", "COFFEE(L)": "093022", CORAL: "093023", CREAM: "093024",
  "CREAM(D)": "093025", "CREAM(L)": "093026", "CREAM(P)": "093027", GOLD: "093028",
  "GOLD(D)": "093029", "GOLD(L)": "093030", GREEN: "093031", "GREEN(D)": "093032",
  "GREEN(L)": "093033", "GREEN(P)": "093034", GREY: "093035", "GREY(D)": "093036",
  "GREY(L)": "093037", "GREY(M)": "093038", "GREY(P)": "093039", ICE: "093040",
  INDIGO: "093041", IVORY: "093042", "IVORY(L)": "093043", KHAKI: "093044",
  "KHAKI(D)": "093045", "KHAKI(L)": "093046", "KHAKI(P)": "093047", LEMON: "093048",
  LIME: "093049", MILITARY: "093050", MINT: "093051", MOSS: "093052",
  MUSTARD: "093053", NAVY: "093054", "NAVY(D)": "093055", "NAVY(L)": "093056",
  "NAVY(P)": "093057", OATMEAL: "093058", OLIVE: "093059", ORANGE: "093060",
  "ORANGE(D)": "093061", "ORANGE(L)": "093062", "ORANGE(P)": "093063", PINK: "093064",
  "PINK(D)": "093065", "PINK(L)": "093066", "PINK(P)": "093067", PURPLE: "093068",
  "PURPLE(D)": "093069", "PURPLE(L)": "093070", "PURPLE(P)": "093071", RED: "093072",
  "RED(D)": "093073", "RED(L)": "093074", "RED(P)": "093075", SILVER: "093076",
  "SILVER(D)": "093077", "SILVER(L)": "093078", SKIN: "093079", "SKIN(D)": "093080",
  "SKIN(L)": "093081", "SKIN(P)": "093082", SKY: "093083", "SKY(L)": "093084",
  SKYBLUE: "093085", TEAL: "093086", VIOLET: "093087", "VIOLET(D)": "093088",
  "VIOLET(L)": "093089", "VIOLET(P)": "093090", WHITE: "093091", "WHITE(D)": "093092",
  "WHITE(L)": "093093", "WHITE(P)": "093094", WINE: "093095", YELLOW: "093096",
  "YELLOW(D)": "093097", "YELLOW(L)": "093098", "YELLOW(P)": "093099", MULTIPLE: "093109",
}

/** 코드표에 없는 우리 컬러명 → 코드표 색상명 별칭 */
const COLOR_ALIASES: Record<string, string> = {
  GRAY: "GREY",
  "OFF WHITE": "WHITE",
  OFFWHITE: "WHITE",
  MULTI: "MULTIPLE",
  "SKY BLUE": "SKYBLUE",
}

/** 유아의류 사이즈코드 (55~130cm, 개월 수, Free) */
export const GS1_BABY_SIZE_CODES: Record<string, string> = {
  "55": "006001", "60": "006002", "65": "006023", "70": "006003", "75": "006004",
  "80": "006005", "85": "006006", "90": "006007", "95": "006008", "100": "006009",
  "110": "006010", "120": "006011", "130": "006012",
  "3M": "006013", "6M": "006014", "9M": "006015", "12M": "006016", "18M": "006017",
  "24M": "006018", "30M": "006019", "36M": "006020", "48M": "006021", FREE: "006022",
}

/** 아동의류 사이즈코드 (90~180cm, S/M/L, Free) */
export const GS1_KIDS_SIZE_CODES: Record<string, string> = {
  "90": "007017", "95": "007020", "100": "007001", "110": "007002", "120": "007003",
  "130": "007004", "135": "007018", "140": "007005", "145": "007014", "150": "007006",
  "155": "007015", "160": "007007", "165": "007016", "170": "007008", "175": "007019",
  "180": "007009", S: "007010", M: "007011", L: "007012", FREE: "007013",
}

/** 국가명/키워드 → ISO 2자리 국가코드 (제조국·생산국) */
const COUNTRY_KEYWORDS: [RegExp, string][] = [
  [/한국|korea/i, "KR"],
  [/중국|china/i, "CN"],
  [/베트남|vietnam|viet nam/i, "VN"],
  [/인도네시아|indonesia/i, "ID"],
  [/방글라데시|bangladesh/i, "BD"],
  [/미얀마|myanmar/i, "MM"],
  [/캄보디아|cambodia/i, "KH"],
  [/태국|thailand/i, "TH"],
  [/인도(?!네시아)|india/i, "IN"],
  [/터키|튀르키예|turkey|turkiye/i, "TR"],
]

/** 컬러명 → GS1 색상코드. 못 찾으면 null. */
export function gs1ColorCode(name: string): string | null {
  const key = name.trim().toUpperCase()
  const resolved = COLOR_ALIASES[key] ?? key
  return GS1_COLOR_CODES[resolved] ?? null
}

/**
 * 사이즈명 → GS1 사이즈코드. 연령대에 맞는 표를 먼저 보고, 없으면
 * 다른 표도 본다(85는 유아, 140은 아동에만 있다). 못 찾으면 null.
 */
export function gs1SizeCode(name: string, ageGroup: string | null): string | null {
  let key = name.trim().toUpperCase()
  if (key === "F") key = "FREE"
  const baby = GS1_BABY_SIZE_CODES[key]
  const kids = GS1_KIDS_SIZE_CODES[key]
  if (ageGroup === "BABY" || ageGroup === "NEWBORN") return baby ?? kids ?? null
  return kids ?? baby ?? null
}

/** 원산지 문자열 → ISO 국가코드. 못 찾으면 null. */
export function gs1CountryCode(origin: string | null): string | null {
  if (!origin) return null
  const v = origin.trim()
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase()
  for (const [re, code] of COUNTRY_KEYWORDS) if (re.test(v)) return code
  return null
}

/** 수입여부: 1 수입제품아님 / 2 수입상품(OEM 포함). 제조국을 모르면 빈칸. */
export function gs1ImportFlag(countryCode: string | null): string {
  if (!countryCode) return ""
  return countryCode === "KR" ? "1" : "2"
}
