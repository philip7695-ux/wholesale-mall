/**
 * 상품의 원산지·혼용률은 DB 에 한국어(+영어 혼용) 원문으로 저장돼 있다.
 * 데이터를 건드리지 않고 화면에서만 로케일에 맞게 바꿔 보여준다.
 *
 * 값의 종류가 유한하므로(나라 몇 개, 부위·소재 용어) 사전으로 옮긴다.
 * 사전에 없는 말(드문 소재, 색상 약어, 오타)은 원문을 그대로 둔다 —
 * 통관·상품등록에 쓰는 값이라 틀리게 옮기느니 원문이 낫다.
 */

type Tr = { en?: string; ja?: string; zh?: string }

const pick = (tr: Tr, locale: string, fallback: string): string =>
  (tr as Record<string, string | undefined>)[locale] ?? fallback

// 원산지 국가
const COUNTRY: Record<string, Tr> = {
  대한민국: { en: "Republic of Korea", ja: "韓国", zh: "韩国" },
  중국: { en: "China", ja: "中国", zh: "中国" },
  베트남: { en: "Vietnam", ja: "ベトナム", zh: "越南" },
  미얀마: { en: "Myanmar", ja: "ミャンマー", zh: "缅甸" },
}

// 원산지 괄호 안 도시(주로 중국 도시)
const CITY: Record<string, Tr> = {
  광주: { en: "Guangzhou", ja: "広州", zh: "广州" },
  위해: { en: "Weihai", ja: "威海", zh: "威海" },
  청도: { en: "Qingdao", ja: "青島", zh: "青岛" },
  연태: { en: "Yantai", ja: "煙台", zh: "烟台" },
  안산: { en: "Anshan", ja: "鞍山", zh: "鞍山" },
}

/**
 * 부위·라벨 용어. 영어 라벨과 한글이 같은 뜻으로 짝지어 나오므로(SHELL=겉감)
 * 영어 대문자 키와 한글 키 둘 다 같은 번역을 가리키게 둔다.
 * en 값도 함께 두어 영어 화면에서도 사람이 읽기 좋은 말로 통일한다.
 */
const PART: Record<string, Tr> = {
  SHELL: { en: "Shell", ja: "表地", zh: "面料" }, 겉감: { en: "Shell", ja: "表地", zh: "面料" },
  LINING: { en: "Lining", ja: "裏地", zh: "里料" }, 안감: { en: "Lining", ja: "裏地", zh: "里料" },
  POINT: { en: "Contrast", ja: "配色", zh: "配色" }, 배색: { en: "Contrast", ja: "配色", zh: "配色" },
  PADDING: { en: "Padding", ja: "中綿", zh: "填充棉" }, 충전재: { en: "Filling", ja: "中綿", zh: "填充物" },
  상의: { en: "Top", ja: "上衣", zh: "上衣" },
  하의: { en: "Bottom", ja: "下衣", zh: "下装" },
  치마: { en: "Skirt", ja: "スカート", zh: "裙子" },
  원피스: { en: "Dress", ja: "ワンピース", zh: "连衣裙" },
  레이스: { en: "Lace", ja: "レース", zh: "蕾丝" },
  모자: { en: "Hood", ja: "フード", zh: "帽子" },
  장식: { en: "Trim", ja: "装飾", zh: "装饰" },
  프레임: { en: "Frame", ja: "フレーム", zh: "镜框" },
  렌즈: { en: "Lens", ja: "レンズ", zh: "镜片" },
  기타: { en: "Other", ja: "その他", zh: "其他" },
}

// 소재(섬유)명. 영어는 원문을 그대로 두므로 ja/zh 만 둔다.
const FIBER: Record<string, Tr> = {
  COTTON: { ja: "綿", zh: "棉" },
  POLYESTER: { ja: "ポリエステル", zh: "聚酯纤维" },
  POLYURETHANE: { ja: "ポリウレタン", zh: "聚氨酯" },
  RAYON: { ja: "レーヨン", zh: "人造丝" },
  MODAL: { ja: "モダール", zh: "莫代尔" },
  NYLON: { ja: "ナイロン", zh: "锦纶" },
  ACRYLIC: { ja: "アクリル", zh: "腈纶" },
  WOOL: { ja: "ウール", zh: "羊毛" },
  LINEN: { ja: "リネン", zh: "亚麻" },
  LYOCELL: { ja: "リヨセル", zh: "莱赛尔" },
  VISCOSE: { ja: "ビスコース", zh: "粘胶" },
  TENCEL: { ja: "テンセル", zh: "天丝" },
  CASHMERE: { ja: "カシミヤ", zh: "羊绒" },
  POLYAMIDE: { ja: "ポリアミド", zh: "聚酰胺" },
  POLYPROPYLENE: { ja: "ポリプロピレン", zh: "聚丙烯" },
  POLYETHYLENE: { ja: "ポリエチレン", zh: "聚乙烯" },
  ELASTODIENE: { ja: "エラストジエン", zh: "弹性纤维" },
  BAMBOO: { ja: "竹繊維", zh: "竹纤维" },
  DOWN: { ja: "ダウン", zh: "羽绒" },
  FEATHER: { ja: "フェザー", zh: "羽毛" },
  DUCK: { ja: "ダック", zh: "鸭毛" },
  LEATHER: { ja: "レザー", zh: "皮革" },
}

/** "중국(광주)" → 로케일에 맞는 국가(도시) */
export function translateOrigin(origin: string | null, locale: string): string {
  if (!origin) return ""
  if (locale === "ko") return origin

  const m = origin.trim().match(/^([^(（]+)(?:[(（]([^)）]+)[)）])?$/)
  if (!m) return origin
  const base = m[1].trim()
  const city = m[2]?.trim()

  const baseTr = COUNTRY[base] ? pick(COUNTRY[base], locale, base) : base
  if (!city) return baseTr
  const cityTr = CITY[city] ? pick(CITY[city], locale, city) : city
  return `${baseTr} (${cityTr})`
}

/**
 * 혼용률을 로케일 언어로 바꾼다.
 *   `SHELL(겉감): POLYESTER 100%` → (ja) `表地: ポリエステル 100%`
 *
 * 1) `영어라벨(한글)` 꼴은 라벨만 번역하고 겹치는 한글 괄호는 지운다.
 * 2) 남은 홑 영어 소재명을 번역한다(영어 화면은 원문 유지).
 * 3) 남은 홑 한글 용어를 번역한다.
 * 조성 숫자(`100%`)와 사전에 없는 말은 그대로 둔다.
 */
export function translateMaterial(material: string | null, locale: string): string {
  if (!material) return ""
  if (locale === "ko") return material

  // 1) 영어라벨(한글) — 라벨만 남겨 번역
  let out = material.replace(
    /([A-Za-z]+)\s*[(（]\s*([가-힣]+)\s*[)）]/g,
    (_m, label: string) => {
      const key = label.toUpperCase()
      return PART[key] ? pick(PART[key], locale, label) : label
    },
  )

  // 2) 홑 영어 토큰(소재·라벨)
  out = out.replace(/[A-Za-z][A-Za-z-]+/g, (tok) => {
    const key = tok.toUpperCase()
    if (PART[key]) return pick(PART[key], locale, tok)
    if (FIBER[key]) return locale === "en" ? tok : pick(FIBER[key], locale, tok)
    return tok
  })

  // 3) 홑 한글 용어
  out = out.replace(/[가-힣]+/g, (kor) => (PART[kor] ? pick(PART[kor], locale, kor) : kor))

  return out
}
