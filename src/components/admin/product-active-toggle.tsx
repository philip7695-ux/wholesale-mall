"use client"

import { useState, useTransition } from "react"
import { useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff, Loader2 } from "lucide-react"

/**
 * 목록에서 바로 노출 여부를 끄고 켠다.
 *
 * 카드 전체가 수정 페이지로 가는 링크라 클릭이 새어나가지 않게 막는다.
 * 응답을 기다리는 동안 화면을 먼저 바꿔 200개를 훑으며 처리할 때
 * 끊기지 않게 하고, 실패하면 되돌린다.
 */
export function ProductActiveToggle({
  productId,
  isActive,
  activeLabel,
  inactiveLabel,
}: {
  productId: string
  isActive: boolean
  activeLabel: string
  inactiveLabel: string
}) {
  const router = useRouter()
  const [active, setActive] = useState(isActive)
  const [saving, setSaving] = useState(false)
  const [, startTransition] = useTransition()

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (saving) return

    const next = !active
    setActive(next)
    setSaving(true)
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      })
      if (!res.ok) throw new Error(String(res.status))
      startTransition(() => router.refresh())
    } catch {
      setActive(!next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Button
      variant={active ? "outline" : "secondary"}
      size="sm"
      onClick={toggle}
      disabled={saving}
      title={active ? inactiveLabel : activeLabel}
    >
      {saving ? (
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      ) : active ? (
        <Eye className="mr-1 h-3 w-3" />
      ) : (
        <EyeOff className="mr-1 h-3 w-3" />
      )}
      {active ? activeLabel : inactiveLabel}
    </Button>
  )
}
