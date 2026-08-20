/**
 * 상품자료 JSON 을 몰 DB 에 등록한다.
 *
 * 어드민 대량등록 API 와 같은 규칙을 따른다. 다만 2,500개를 브라우저로
 * 올리면 청크가 수백 번 오가므로, 같은 변환을 서버 쪽에서 한 번에 한다.
 * 연령대 판별은 src/lib/product-sizes.ts 의 determineAgeGroup 과 동일하다.
 *
 *   node scripts/load-products.cjs <입력.json> [--dry]
 */
const { Pool } = require("pg")
const fs = require("fs")
const crypto = require("crypto")

const KIDS_NUM_SIZES = ["80","85","90","95","100","110","120","130","140","150"]
const KIDS_LETTER_SIZES = ["F","S","M","L","XL","XXL"]
const BABY_NUM = new Set(["80","85","90","95","100"])
const KIDS_ONLY_NUM = new Set(["110","120","130","140","150"])
const SIZE_ORDER = [...KIDS_NUM_SIZES, ...KIDS_LETTER_SIZES]

/** 코드 3~4번째 두 자리. 정렬·필터에 쓴다. BP63AC317 -> "63" */
const seasonKeyOf = (code) => {
  const k = (code || "").slice(2, 4)
  return /^[3-9][1-4]$/.test(k) ? k : null
}

function determineAgeGroup(name, sizes) {
  const n = (name || "").toLowerCase()
  const hasBaby = n.includes("baby")
  if (n.includes("newborn") && !sizes.some((s) => KIDS_ONLY_NUM.has(s))) return "NEWBORN"
  const babyNum = sizes.some((s) => BABY_NUM.has(s))
  const kidsNum = sizes.some((s) => KIDS_ONLY_NUM.has(s))
  const letter = sizes.some((s) => KIDS_LETTER_SIZES.includes(s))
  const adultOnly = sizes.some((s) => ["XS","XL","2XL","3XL","FREE"].includes(s))
  if (babyNum && !kidsNum) return "BABY"
  if (kidsNum && !babyNum) return "KIDS"
  if (babyNum && kidsNum) return hasBaby ? "BABY" : "KIDS"
  if (adultOnly && !letter) return null
  if (letter) return hasBaby ? "BABY" : "KIDS"
  return null
}

// Prisma 의 cuid 와 형태를 맞춘다(길이·접두어). 유일하기만 하면 된다.
let counter = 0
const cuid = () =>
  "c" + Date.now().toString(36) + (counter++).toString(36).padStart(4, "0") +
  crypto.randomBytes(6).toString("hex")

function env(key) {
  const m = fs.readFileSync(".env.local", "utf8").match(new RegExp("^" + key + "=(.*)$", "m"))
  return m ? m[1].trim().replace(/^"|"$/g, "") : ""
}

async function insertMany(client, table, cols, rows, batch = 400) {
  for (let i = 0; i < rows.length; i += batch) {
    const slice = rows.slice(i, i + batch)
    const ph = [], vals = []
    slice.forEach((r, ri) => {
      ph.push("(" + cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(",") + ")")
      cols.forEach((c) => vals.push(r[c]))
    })
    await client.query(
      `insert into mall."${table}" (${cols.map((c) => `"${c}"`).join(",")}) values ${ph.join(",")}`,
      vals,
    )
  }
}

async function main() {
  const input = process.argv[2]
  const dry = process.argv.includes("--dry")
  if (!input) { console.error("입력 JSON 경로가 필요합니다."); process.exit(1) }

  const records = JSON.parse(fs.readFileSync(input, "utf8"))
  const pool = new Pool({ connectionString: env("NEON_POOLED_URL"), connectionTimeoutMillis: 20000 })

  const cats = (await pool.query(`select id, slug from mall."Category"`)).rows
  const catId = Object.fromEntries(cats.map((c) => [c.slug, c.id]))

  // 코드 단위로 묶는다. 한 코드의 여러 컬러가 한 상품이 된다.
  const byCode = new Map()
  for (const r of records) {
    if (!byCode.has(r.code)) byCode.set(r.code, [])
    byCode.get(r.code).push(r)
  }

  const existing = new Set(
    (await pool.query(`select code from mall."Product" where code is not null`)).rows.map((r) => r.code),
  )
  const dup = [...byCode.keys()].filter((c) => existing.has(c))
  if (dup.length) console.log(`이미 등록된 코드 ${dup.length}개는 건너뜁니다. 예: ${dup.slice(0, 5).join(", ")}`)

  const products = [], colors = [], sizes = [], variants = []
  const now = new Date()
  let skippedCat = 0

  for (const [code, group] of byCode) {
    if (existing.has(code)) continue
    const head = group[0]
    const cid = catId[head.cat]
    if (!cid) { skippedCat++; continue }

    const allSizes = [...new Set(group.flatMap((g) => g.sizes))]
      .sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b))

    const pid = cuid()
    products.push({
      id: pid, name: head.name, description: null, categoryId: cid, thumbnail: null,
      isActive: true, sortOrder: 0, createdAt: now, updatedAt: now, sizeSpec: null,
      images: [], code, seasonKey: seasonKeyOf(code), material: head.material || null,
      brand: head.brand || null, origin: head.origin || null,
      majorCategory: head.major || null,
      moq: 0, colorMoq: 0, priceCurrency: "KRW",
      ageGroup: head.age || determineAgeGroup(head.name, allSizes),
    })

    const sizeId = {}
    allSizes.forEach((s, i) => {
      const id = cuid(); sizeId[s] = id
      sizes.push({ id, productId: pid, name: s, sortOrder: i, createdAt: now, updatedAt: now })
    })

    group.forEach((g, i) => {
      const colId = cuid()
      colors.push({
        id: colId, productId: pid, name: g.color, colorCode: g.colorcode || null,
        hexColor: null, images: [], sortOrder: i, moq: 0, createdAt: now, updatedAt: now,
      })
      for (const s of g.sizes) {
        variants.push({
          id: cuid(), productId: pid, colorId: colId, sizeId: sizeId[s],
          price: g.price, stock: 0, createdAt: now, updatedAt: now,
        })
      }
    })
  }

  console.log(`\n등록 대상`)
  console.log(`  상품   ${products.length}`)
  console.log(`  컬러   ${colors.length}`)
  console.log(`  사이즈 ${sizes.length}`)
  console.log(`  변형   ${variants.length}`)
  if (skippedCat) console.log(`  카테고리 없어 제외: ${skippedCat}`)
  if (dry) { console.log("\n--dry 이므로 쓰지 않았습니다."); process.exit(0) }

  const client = await pool.connect()
  try {
    await client.query("begin")
    await insertMany(client, "Product", ["id","name","description","categoryId","thumbnail","isActive","sortOrder","createdAt","updatedAt","sizeSpec","images","code","seasonKey","material","brand","origin","majorCategory","moq","colorMoq","priceCurrency","ageGroup"], products)
    console.log("  상품 완료")
    await insertMany(client, "ProductColor", ["id","productId","name","colorCode","hexColor","images","sortOrder","moq","createdAt","updatedAt"], colors)
    console.log("  컬러 완료")
    await insertMany(client, "ProductSize", ["id","productId","name","sortOrder","createdAt","updatedAt"], sizes)
    console.log("  사이즈 완료")
    await insertMany(client, "ProductVariant", ["id","productId","colorId","sizeId","price","stock","createdAt","updatedAt"], variants)
    console.log("  변형 완료")
    await client.query("commit")
    console.log("\n커밋했습니다.")
  } catch (e) {
    await client.query("rollback")
    console.error("\n실패 — 전부 되돌렸습니다:", e.message)
    process.exit(1)
  } finally {
    client.release()
  }
  process.exit(0)
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1) })
