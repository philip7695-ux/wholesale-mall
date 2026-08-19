import { NextResponse } from "next/server"
import { isTransientDbError, withDbRetry } from "@/lib/db-retry"

/**
 * API 라우트 공통 래퍼.
 *
 * 핸들러에서 예외가 그대로 새어 나가면 Next 는 본문 없는 500 을 응답한다.
 * 클라이언트가 res.json() 을 호출하면 "Unexpected end of JSON input" 으로
 * 터지므로, 사용자에게는 원인을 알 수 없는 화면만 남는다.
 *
 * 이 래퍼는 어떤 경우에도 JSON 으로 응답하고, DB 일시 장애는 503 으로
 * 구분해 클라이언트가 재시도를 안내할 수 있게 한다.
 */

type Handler<A extends unknown[]> = (...args: A) => Promise<Response>

export function apiRoute<A extends unknown[]>(
  fn: Handler<A>,
  { retry = false }: { retry?: boolean } = {},
): Handler<A> {
  return async (...args: A) => {
    try {
      // 읽기 전용 핸들러만 재시도한다. 쓰기는 중복 실행 위험이 있다.
      return retry ? await withDbRetry(() => fn(...args)) : await fn(...args)
    } catch (err: any) {
      const transient = isTransientDbError(err)
      console.error(`[api] ${transient ? "transient " : ""}error:`, err)
      return NextResponse.json(
        {
          error: transient
            ? "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
            : "요청을 처리하지 못했습니다.",
        },
        { status: transient ? 503 : 500 },
      )
    }
  }
}
