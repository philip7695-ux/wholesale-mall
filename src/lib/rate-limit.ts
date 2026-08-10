// 경량 in-memory rate limiter.
// 주의: 서버리스(Vercel)에서는 인스턴스마다 메모리가 분리되고 콜드스타트 시 초기화되므로
// 완벽한 방어가 아니라 "동일 인스턴스로 몰리는 빠른 연속 시도"에 대한 1차 방어선이다.
// 강력한 보호가 필요하면 Upstash Redis 등 공유 저장소 기반 limiter로 교체할 것.

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

/**
 * @param key      제한 대상 식별자 (예: `login:user@example.com`)
 * @param limit    windowMs 동안 허용 횟수
 * @param windowMs 시간 창(ms)
 * @returns true = 허용, false = 초과
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const b = buckets.get(key)

  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    // 메모리 누수 방지: 가끔 만료된 버킷 정리
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (now >= v.resetAt) buckets.delete(k)
      }
    }
    return true
  }

  if (b.count >= limit) return false
  b.count += 1
  return true
}
