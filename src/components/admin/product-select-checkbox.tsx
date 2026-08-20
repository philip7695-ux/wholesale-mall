"use client"

import { useProductSelection } from "@/components/admin/product-grid"
import { Check } from "lucide-react"

/**
 * 카드 왼쪽 위 선택 표시.
 *
 * 카드 전체가 수정 페이지로 가는 링크라 클릭이 새어나가지 않게 막는다.
 */
export function ProductSelectCheckbox({ id, label }: { id: string; label: string }) {
  const { selected, toggle } = useProductSelection()
  const on = selected.has(id)

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(id)
      }}
      className={`absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded border transition-colors ${
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-gray-300 bg-white/90 hover:border-gray-400"
      }`}
    >
      {on && <Check className="h-3.5 w-3.5" />}
    </button>
  )
}
