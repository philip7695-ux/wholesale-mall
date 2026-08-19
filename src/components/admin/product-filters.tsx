"use client"

import { useRouter, usePathname } from "@/i18n/navigation"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

type Option = { value: string; label: string }

/**
 * 연도·시즌·카테고리 필터. 선택은 URL 검색 파라미터에 담아
 * 서버에서 걸러낸다. 상품이 수천 개로 늘어도 목록을 다 내려받지 않는다.
 */
export function ProductFilters({
  brands,
  years,
  seasons,
  categories,
  allLabel,
  resetLabel,
  countLabel,
}: {
  brands: Option[]
  years: Option[]
  seasons: Option[]
  categories: Option[]
  allLabel: string
  resetLabel: string
  countLabel: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  const groups: { key: string; options: Option[] }[] = [
    { key: "brand", options: brands },
    { key: "year", options: years },
    { key: "season", options: seasons },
    { key: "category", options: categories },
  ]

  const hasFilter = groups.some((g) => params.get(g.key))

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
      {groups.map((g) => (
        <select
          key={g.key}
          value={params.get(g.key) ?? ""}
          onChange={(e) => setParam(g.key, e.target.value)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">{allLabel}</option>
          {g.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      {hasFilter && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
          <X className="mr-1 h-3 w-3" />
          {resetLabel}
        </Button>
      )}
      <span className="ml-auto text-sm text-muted-foreground">{countLabel}</span>
    </div>
  )
}
