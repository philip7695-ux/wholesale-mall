/**
 * 카테고리 재분류.
 *
 * 상품 자료의 '아이템' 값을 몰 카테고리로 매핑할 때 성격이 다른 것들을
 * 한데 묶어둔 곳이 있었다.
 *
 *   세트     : 진짜 세트 + 오버롤 + 바디수트(자료상 '슈트')가 섞임
 *   액세서리 : 모자·양말·가방이 기타와 함께 묶임
 *
 * 아이템별 스타일코드 목록을 근거로 옮긴다. 상품명으로 판단하면
 * 'overall set' 처럼 이름만 겹치는 것을 잘못 옮기게 된다.
 *
 *   node scripts/recategorize.cjs <plan.json> [--dry]
 *
 * plan.json: [{ slug, name, sortOrder, codes: [...] }, ...]
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
  if (!input) { console.error("plan.json 경로가 필요합니다."); process.exit(1) }

  const plan = JSON.parse(fs.readFileSync(input, "utf8"))
  const pool = new Pool({ connectionString: env("NEON_POOLED_URL"), connectionTimeoutMillis: 20000 })

  const before = (await pool.query(`
    select c.slug, count(*)::int n from mall."Product" p
    join mall."Category" c on c.id = p."categoryId" group by 1 order by 2 desc`)).rows
  console.log("변경 전:")
  before.forEach((r) => console.log(`  ${r.slug.padEnd(12)} ${r.n}`))

  const client = await pool.connect()
  try {
    await client.query("begin")
    console.log("\n이동:")
    for (const g of plan) {
      // 카테고리가 없으면 만든다
      let { rows } = await client.query(`select id from mall."Category" where slug=$1`, [g.slug])
      if (!rows.length) {
        const max = (await client.query(`select coalesce(max("sortOrder"),0)::int m from mall."Category"`)).rows[0].m
        rows = (await client.query(
          `insert into mall."Category" (id,name,slug,"sortOrder","createdAt","updatedAt")
           values (gen_random_uuid()::text,$1,$2,$3,now(),now()) returning id`,
          [g.name, g.slug, g.sortOrder ?? max + 1],
        )).rows
      }
      const res = await client.query(
        `update mall."Product" set "categoryId"=$1, "updatedAt"=now() where code = any($2)`,
        [rows[0].id, g.codes],
      )
      console.log(`  ${g.slug.padEnd(12)} ${res.rowCount} 개 (대상 코드 ${g.codes.length})`)
    }
    if (dry) {
      await client.query("rollback")
      console.log("\n--dry 이므로 되돌렸습니다.")
    } else {
      await client.query("commit")
      console.log("\n커밋했습니다.")
    }
  } catch (e) {
    await client.query("rollback")
    console.error("\n실패 — 되돌렸습니다:", e.message)
    process.exit(1)
  } finally { client.release() }

  const after = (await pool.query(`
    select c.slug, count(*)::int n from mall."Product" p
    join mall."Category" c on c.id = p."categoryId" group by 1 order by 2 desc`)).rows
  console.log("\n변경 후:")
  after.forEach((r) => console.log(`  ${r.slug.padEnd(12)} ${r.n}`))
  const [t] = (await pool.query(`select count(*)::int n from mall."Product"`)).rows
  const sum = after.reduce((s, r) => s + r.n, 0)
  console.log(`\n합계 ${sum} / 전체 상품 ${t.n} ${sum === t.n ? "(일치)" : "(불일치 !!)"}`)
  process.exit(0)
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1) })
