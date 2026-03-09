import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

// 스키마 변경 시 이 값을 바꾸면 캐시된 클라이언트가 재생성됨
const SCHEMA_VERSION = 8

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaVersion: number | undefined
  pool: Pool | undefined
}

function createPool() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 10000,
  })

  // 커넥션 에러 시 풀이 죽지 않도록 에러 핸들링
  pool.on("error", (err) => {
    console.error("Unexpected PG pool error:", err.message)
  })

  return pool
}

function createPrismaClient() {
  const pool = globalForPrisma.pool ?? createPool()
  globalForPrisma.pool = pool

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

// 스키마 버전이 바뀌면 캐시된 클라이언트 무효화
if (globalForPrisma.prismaVersion !== SCHEMA_VERSION) {
  globalForPrisma.prisma = undefined
  globalForPrisma.prismaVersion = SCHEMA_VERSION
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

globalForPrisma.prisma = prisma
