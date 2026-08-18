/**
 * DB 일시 장애 재시도.
 *
 * Vercel(도쿄)과 RDS(광저우) 사이가 국경 간 경로라 커넥션 수립이 간헐적으로
 * 실패한다("Connection terminated due to connection timeout" /
 * "Connection terminated unexpectedly"). 쿼리 자체는 정상이므로 짧게 재시도하면
 * 대부분 다음 시도에서 성공한다.
 *
 * 재시도는 읽기 전용 작업에만 쓴다. 쓰기 작업은 중복 실행 위험이 있으므로
 * 호출부에서 멱등성을 보장할 때만 사용할 것.
 */

const TRANSIENT_PATTERNS = [
  "connection terminated",
  "connection timeout",
  "timeout exceeded",
  "econnreset",
  "epipe",
  "socket hang up",
  "server closed the connection",
]

export function isTransientDbError(err: unknown): boolean {
  const parts: string[] = []
  let cur: any = err
  for (let i = 0; i < 4 && cur; i++) {
    if (typeof cur.message === "string") parts.push(cur.message)
    cur = cur.cause
  }
  const text = parts.join(" ").toLowerCase()
  return TRANSIENT_PATTERNS.some((p) => text.includes(p))
}

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  { attempts = 3, baseDelayMs = 250 }: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i === attempts - 1 || !isTransientDbError(err)) throw err
      // 지수 백오프. 커넥션이 새로 맺힐 시간을 준다.
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** i))
    }
  }
  throw lastErr
}
