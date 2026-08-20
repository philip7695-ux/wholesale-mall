/**
 * 재고 JSON 을 ProductVariant.stock 에 반영한다.
 *
 * 입력: [[스타일코드, 색상코드, 사이즈, 수량], ...]  (같은 조합은 미리 합산)
 * 매칭: Product.code + ProductColor.colorCode + ProductSize.name
 *
 *   node scripts/load-stock.cjs <stock.json> [--dry]
 */
const { Pool } = require("pg")
const fs = require("fs")

function env(key) {
  const m = fs.readFileSync(".env.local", "utf8").match(new RegExp("^" + key + "=(.*)$", "m"))
  return m ? m[1].trim().replace(/^"|"$/g, "") : ""
}

async function main() {
  const input = process.argv[2]
  const dry = process.argv.includes("--dry")
  if (!input) { console.error("입력 JSON 경로가 필요합니다."); process.exit(1) }

  const rows = JSON.parse(fs.readFileSync(input, "utf8"))
  const pool = new Pool({ connectionString: env("NEON_POOLED_URL"), connectionTimeoutMillis: 20000 })

  // 변형을 (코드|색상코드|사이즈) 로 색인한다
  const variants = (await pool.query(`
    select v.id, p.code, c."colorCode", c.name as "colorName", s.name as size, v.stock
    from mall."ProductVariant" v
    join mall."Product" p on p.id = v."productId"
    join mall."ProductColor" c on c.id = v."colorId"
    join mall."ProductSize" s on s.id = v."sizeId"`)).rows

  const index = new Map()
  for (const v of variants) {
    if (v.code && v.colorCode) index.set(`${v.code}|${v.colorCode}|${v.size}`, v)
  }
  console.log(`DB 변형 ${variants.length}개 (색인 가능 ${index.size}개)`)

  const updates = []
  const miss = { code: 0, color: 0, size: 0, other: 0 }
  const missCodes = new Set()
  const dbCodes = new Set(variants.map((v) => v.code))

  for (const [code, color, size, qty] of rows) {
    const hit = index.get(`${code}|${color}|${size}`)
    if (hit) { updates.push([hit.id, qty]); continue }
    if (!dbCodes.has(code)) { miss.code++; missCodes.add(code); continue }
    // 코드는 있는데 색상·사이즈가 안 맞는 경우를 구분한다
    const sameCode = variants.filter((v) => v.code === code)
    if (!sameCode.some((v) => v.colorCode === color)) miss.color++
    else if (!sameCode.some((v) => v.size === size)) miss.size++
    else miss.other++
  }

  const total = updates.reduce((s, [, q]) => s + q, 0)
  console.log(`\n매칭      : ${updates.length} / ${rows.length} (${Math.round(updates.length * 100 / rows.length)}%)`)
  console.log(`반영 수량 : ${total.toLocaleString()}`)
  console.log(`불일치    : 상품코드없음 ${miss.code} / 색상없음 ${miss.color} / 사이즈없음 ${miss.size} / 기타 ${miss.other}`)
  if (missCodes.size) {
    const sample = [...missCodes].slice(0, 6).join(", ")
    console.log(`  없는 코드 ${missCodes.size}종 예: ${sample}`)
  }
  if (dry) { console.log("\n--dry 이므로 쓰지 않았습니다."); process.exit(0) }

  const client = await pool.connect()
  try {
    await client.query("begin")
    // 자료에 없는 변형은 0 으로 되돌린다. 남겨두면 과거 값이 유령처럼 남는다.
    // reserved 는 건드리지 않는다. 진행 중인 주문이 물고 있는 수량이라
    // 여기서 지우면 중복 판매가 생긴다.
    await client.query(`update mall."ProductVariant" set stock = 0 where stock <> 0`)
    const BATCH = 500
    for (let i = 0; i < updates.length; i += BATCH) {
      const slice = updates.slice(i, i + BATCH)
      const ids = slice.map(([id]) => id)
      const qs = slice.map(([, q]) => q)
      await client.query(
        `update mall."ProductVariant" v set stock = x.qty, "updatedAt" = now()
         from (select unnest($1::text[]) as id, unnest($2::int[]) as qty) x
         where v.id = x.id`,
        [ids, qs],
      )
    }
    // 목록 정렬용 플래그를 재계산한다. 이 값이 어긋나면 품절 상품이
    // 앞에 오거나 판매 가능한 상품이 뒤로 밀린다.
    await client.query(`
      update mall."Product" p set
        "inStock" = exists (
          select 1 from mall."ProductVariant" v
          where v."productId" = p.id and v.stock - v.reserved > 0
        ),
        "totalStock" = coalesce((
          select sum(greatest(v.stock - v.reserved, 0))::int
          from mall."ProductVariant" v where v."productId" = p.id
        ), 0)`)
    await client.query("commit")
    console.log("\n커밋했습니다.")
  } catch (e) {
    await client.query("rollback")
    console.error("\n실패 — 되돌렸습니다:", e.message)
    process.exit(1)
  } finally { client.release() }

  const [c] = (await pool.query(`
    select count(*) filter (where stock > 0)::int inStock,
           sum(stock)::bigint total from mall."ProductVariant"`)).rows
  console.log(`재고 있는 변형: ${c.instock} / 총 수량 ${Number(c.total).toLocaleString()}`)
  process.exit(0)
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1) })
