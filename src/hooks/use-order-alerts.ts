"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"

/**
 * 바이어가 손댈 차례인 주문 수. 관리자 사이드바 배지와 같은 방식으로
 * 60초 폴링 + 탭 복귀 시 즉시 갱신한다.
 */
export function useOrderAlerts(): number {
  const { status } = useSession()
  const [count, setCount] = useState(0)

  useEffect(() => {
    // 비로그인 상태면 폴링하지 않는다. (동기 setState 로 초기화하지 않고
    // 다음 인증 시 fetch 결과가 값을 채운다.)
    if (status !== "authenticated") return
    let alive = true
    const load = () =>
      fetch("/api/orders/notifications")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d) setCount(d.actionRequired ?? 0)
        })
        .catch(() => {})
    load()
    const id = setInterval(load, 60_000)
    const onFocus = () => load()
    window.addEventListener("focus", onFocus)
    return () => {
      alive = false
      clearInterval(id)
      window.removeEventListener("focus", onFocus)
    }
  }, [status])

  return count
}
