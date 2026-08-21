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
    if (status !== "authenticated") {
      setCount(0)
      return
    }
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
