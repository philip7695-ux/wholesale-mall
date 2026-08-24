import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import {
  adjustReservation,
  releaseReservation,
  commitReservation,
  restoreStock,
  refreshProductStock,
} from "@/lib/order-revision"

/**
 * 재고 예약/차감/복구 통합 테스트.
 *
 * Docker 없이도 돌도록 pglite(WASM 실제 Postgres)를 TCP 로 띄우고
 * 실제 Prisma(adapter-pg)로 order-revision.ts 의 raw SQL 을 그대로 실행한다.
 * 돈·재고에 직접 영향을 주는 흐름이라 실제 DB 동작을 검증한다.
 */
const PORT = 55432
let db: PGlite
let server: PGLiteSocketServer
let pool: Pool
let prisma: PrismaClient

beforeAll(async () => {
  db = await PGlite.create()
  server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1" })
  await server.start()

  // 함수들이 건드리는 테이블만 최소로 만든다(raw SQL 은 모델과 무관하게 통과).
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS mall;
    CREATE TABLE mall."Product" (
      id text PRIMARY KEY,
      "inStock" boolean DEFAULT true,
      "totalStock" int DEFAULT 0
    );
    CREATE TABLE mall."ProductVariant" (
      id text PRIMARY KEY,
      "productId" text,
      stock int DEFAULT 0,
      reserved int DEFAULT 0,
      "updatedAt" timestamptz DEFAULT now()
    );
    CREATE TABLE mall."Order" (id text PRIMARY KEY);
    CREATE TABLE mall."OrderItem" (
      id text PRIMARY KEY,
      "orderId" text,
      "variantId" text,
      quantity int
    );
  `)

  pool = new Pool({ host: "127.0.0.1", port: PORT, user: "postgres", database: "postgres", ssl: false })
  const adapter = new PrismaPg(pool)
  prisma = new PrismaClient({ adapter })
}, 60000)

afterAll(async () => {
  await prisma?.$disconnect().catch(() => {})
  await pool?.end().catch(() => {})
  await server?.stop().catch(() => {})
  await db?.close().catch(() => {})
})

// 매 테스트 전에 알려진 상태로 초기화한다.
beforeEach(async () => {
  await db.exec(`
    TRUNCATE mall."Product", mall."ProductVariant", mall."Order", mall."OrderItem";
    INSERT INTO mall."Product"(id) VALUES ('p1');
    INSERT INTO mall."ProductVariant"(id,"productId",stock,reserved) VALUES ('v1','p1',100,0);
    INSERT INTO mall."Order"(id) VALUES ('o1');
    INSERT INTO mall."OrderItem"(id,"orderId","variantId",quantity) VALUES ('oi1','o1','v1',30);
  `)
})

async function variant() {
  const r = await db.query<{ stock: number; reserved: number }>(
    `SELECT stock, reserved FROM mall."ProductVariant" WHERE id='v1'`,
  )
  return r.rows[0]
}

describe("재고 예약 → 확정 → 복구 (실제 DB)", () => {
  it("주문 시 예약만 잡는다(reserved += 수량, stock 불변)", async () => {
    await adjustReservation(prisma, "v1", 30)
    expect(await variant()).toEqual({ stock: 100, reserved: 30 })
  })

  it("확정하면 예약이 실재고 차감으로 바뀐다(stock -=, reserved -=)", async () => {
    await adjustReservation(prisma, "v1", 30)
    await commitReservation(prisma, "o1")
    expect(await variant()).toEqual({ stock: 70, reserved: 0 })
  })

  it("확정 전 취소는 예약만 푼다(실재고 불변)", async () => {
    await adjustReservation(prisma, "v1", 30)
    await releaseReservation(prisma, "o1")
    expect(await variant()).toEqual({ stock: 100, reserved: 0 })
  })

  it("예약은 음수로 내려가지 않는다", async () => {
    await adjustReservation(prisma, "v1", 5)
    await adjustReservation(prisma, "v1", -20)
    expect((await variant()).reserved).toBe(0)
  })

  it("실재고보다 큰 확정도 음수가 되지 않고 0 에서 멈춘다", async () => {
    await db.exec(`UPDATE mall."ProductVariant" SET stock=10, reserved=30 WHERE id='v1'`)
    await commitReservation(prisma, "o1") // 주문 수량 30, 재고 10
    expect((await variant()).stock).toBe(0)
  })

  it("확정 후 출고 전 취소는 실재고를 되돌린다", async () => {
    await adjustReservation(prisma, "v1", 30)
    await commitReservation(prisma, "o1") // stock 70
    await restoreStock(prisma, "o1")
    expect((await variant()).stock).toBe(100)
  })
})

describe("refreshProductStock (판매 가능 기준 재계산)", () => {
  it("판매 가능 수량으로 totalStock·inStock 을 갱신", async () => {
    await db.exec(`UPDATE mall."ProductVariant" SET stock=70, reserved=10 WHERE id='v1'`)
    await refreshProductStock(prisma, ["p1"])
    const p = (await db.query<{ inStock: boolean; totalStock: number }>(
      `SELECT "inStock","totalStock" FROM mall."Product" WHERE id='p1'`,
    )).rows[0]
    // 판매가능 = stock - reserved = 60
    expect(p.totalStock).toBe(60)
    expect(p.inStock).toBe(true)
  })

  it("판매 가능 수량이 0 이면 품절 처리", async () => {
    await db.exec(`UPDATE mall."ProductVariant" SET stock=10, reserved=10 WHERE id='v1'`)
    await refreshProductStock(prisma, ["p1"])
    const p = (await db.query<{ inStock: boolean; totalStock: number }>(
      `SELECT "inStock","totalStock" FROM mall."Product" WHERE id='p1'`,
    )).rows[0]
    expect(p.totalStock).toBe(0)
    expect(p.inStock).toBe(false)
  })
})
