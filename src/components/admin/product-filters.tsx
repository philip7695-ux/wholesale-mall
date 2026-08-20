"use client"

import { useState } from "react"
import { useRouter, usePathname } from "@/i18n/navigation"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Search } from "lucide-react"

type Option = { value: string; label: string }

/**
 * 연도·시즌·카테고리·브랜드·코드 필터.
 *
 * 고를 때마다 바로 조회하면 상품이 수천 개라 매번 기다려야 한다.
 * 조건을 다 채운 뒤 검색을 눌렀을 때만 서버에 간다.
 */
export function ProductFilters({
  brands,
  years,
  seasons,
  categories,
  allLabel,
  resetLabel,
  countLabel,
  searchLabel,
  searchPlaceholder,
}: {
  brands: Option[]
  years: Option[]
  seasons: Option[]
  categories: Option[]
  allLabel: string
  resetLabel: string
  countLabel: string
  searchLabel: string
  searchPlaceholder: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const groups: { key: string; options: Option[] }[] = [
    { key: "brand", options: brands },
    { key: "year", options: years },
    { key: "season", options: seasons },
    { key: "category", options: categories },
  ]

  // 화면에서 고른 값은 검색을 누르기 전까지 여기에만 담아 둔다
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries([
      ...groups.map((g) => [g.key, params.get(g.key) ?? ""]),
      ["code", params.get("code") ?? ""],
    ]),
  )

  function submit() {
    const next = new URLSearchParams()
    for (const [k, v] of Object.entries(draft)) {
      if (v.trim()) next.set(k, v.trim())
    }
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function reset() {
    setDraft(Object.fromEntries(Object.keys(draft).map((k) => [k, ""])))
    router.push(pathname)
  }

  const hasDraft = Object.values(draft).some((v) => v.trim())
  const hasApplied = [...groups.map((g) => g.key), "code"].some((k) => params.get(k))

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
      {groups.map((g) => (
        <select
          key={g.key}
          value={draft[g.key] ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, [g.key]: e.target.value }))}
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

      {/* 스타일 넘버 일부만 넣어도 찾는다 */}
      <Input
        value={draft.code ?? ""}
        onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit()
        }}
        placeholder={searchPlaceholder}
        className="h-9 w-40"
      />

      <Button size="sm" onClick={submit} className="h-9">
        <Search className="mr-1 h-3.5 w-3.5" />
        {searchLabel}
      </Button>

      {(hasDraft || hasApplied) && (
        <Button variant="ghost" size="sm" onClick={reset} className="h-9">
          <X className="mr-1 h-3 w-3" />
          {resetLabel}
        </Button>
      )}

      <span className="ml-auto text-sm text-muted-foreground">{countLabel}</span>
    </div>
  )
}
