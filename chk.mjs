import { config } from 'dotenv'; config({ path: '.env.local' })
import pg from 'pg'
const c = new pg.Client({ connectionString: process.env.DATABASE_URL }); await c.connect()
const q = async (s,p=[]) => (await c.query(s,p)).rows
console.log('상품:', (await q('select count(*)::int n from "mall"."Product"'))[0].n)
console.log('변형:', (await q('select count(*)::int n from "mall"."ProductVariant"'))[0].n)
console.log('연령대별:', await q('select "ageGroup", count(*)::int n from "mall"."Product" group by 1 order by 1'))
console.log('카테고리별:', await q('select c.name, count(p.id)::int n from "mall"."Category" c left join "mall"."Product" p on p."categoryId"=c.id group by 1 order by 2 desc'))
console.log('최근 생성:', await q('select code, name, "createdAt" from "mall"."Product" order by "createdAt" desc limit 3'))
console.log('최초 생성:', await q('select min("createdAt") first, max("createdAt") last from "mall"."Product"'))
await c.end()
