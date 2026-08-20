"use client"

import { useEffect, useRef } from "react"

/**
 * 진행 중인 작업이 있을 때 페이지를 벗어나지 못하게 막는다.
 *
 * 업로드는 브라우저에서 돌아간다. 다른 메뉴를 누르면 그 코드가 사라지면서
 * 올리던 것도 함께 끊긴다. 수백 장을 올리는 도중이면 어디까지 됐는지도
 * 알기 어렵다.
 *
 * 두 가지를 막아야 한다.
 *   - 새로고침·탭 닫기·주소 직접 이동 → beforeunload
 *   - 앱 안의 메뉴 클릭 → 링크 클릭을 캡처 단계에서 가로챈다
 *     (Next 의 클라이언트 이동은 beforeunload 가 뜨지 않는다)
 */
export function useLeaveGuard(active: boolean, message: string) {
  // 리스너를 다시 붙이지 않고도 최신 값을 보도록 참조로 들고 있는다
  const activeRef = useRef(active)
  const messageRef = useRef(message)
  activeRef.current = active
  messageRef.current = message

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!activeRef.current) return
      // 최신 브라우저는 문구를 무시하고 자체 문구를 띄운다.
      // preventDefault 만으로 확인 창이 뜬다.
      e.preventDefault()
      e.returnValue = ""
    }

    function onClick(e: MouseEvent) {
      if (!activeRef.current) return
      // 새 탭으로 여는 조작은 현재 페이지를 떠나지 않으므로 그대로 둔다
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return

      const href = anchor.getAttribute("href") || ""
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      // 같은 주소로의 이동은 화면이 바뀌지 않으므로 막을 이유가 없다
      if (url.pathname === window.location.pathname && url.search === window.location.search) return

      if (!window.confirm(messageRef.current)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    // 캡처 단계에서 잡아야 Next 의 Link 가 이동을 시작하기 전에 끼어들 수 있다
    document.addEventListener("click", onClick, true)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
    }
  }, [])
}
