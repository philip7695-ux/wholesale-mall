import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

// 스키마 변경 시 이 값을 바꾸면 캐시된 클라이언트가 재생성됨
const SCHEMA_VERSION = 12

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaVersion: number | undefined
  pool: Pool | undefined
}

function createPool() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // 알리클라우드 RDS는 SSL 미지원 — DATABASE_SSL=true일 때만 SSL 사용
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
    // 대시보드처럼 한 요청이 여러 쿼리를 병렬 실행하므로 인스턴스당 풀이 너무 작으면
    // 커넥션 획득 대기 → 타임아웃 → 500이 발생한다. 광저우 RDS 국경 간 지연을 감안해
    // 병렬 쿼리를 소화할 정도(max 10)로 두되, RDS는 clothing-erp와 공유하므로 과도하게 키우지 않는다.
    max: 10,
    idleTimeoutMillis: 30000,
    // 국경 간 경로라 커넥션 수립이 간헐적으로 실패한다. 15초를 끝까지 기다리면
    // 함수 실행시간만 소모하고 그대로 500 이 되므로, 빨리 포기하고
    // withDbRetry 가 재시도하도록 한다.
    connectionTimeoutMillis: 6000,
    keepAlive: true,
  })

  // 커넥션 에러 시 죽은 커넥션을 정리하고 풀/클라이언트 재생성
  pool.on("error", (err) => {
    console.error("Unexpected PG pool error:", err.message)
    const dead = globalForPrisma.pool
    globalForPrisma.pool = undefined
    globalForPrisma.prisma = undefined
    // 누수 방지: 기존 풀 종료 (이미 종료 중이면 무시)
    dead?.end().catch(() => {})
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

function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getPrisma() as any)[prop]
  },
})
