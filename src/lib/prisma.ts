import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

function createPool() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
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

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

globalForPrisma.prisma = prisma
