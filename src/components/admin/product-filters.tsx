"use client"

import { useEffect, useState } from "react"
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
  sorts,
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
  sorts: Option[]
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
      ["sort", params.get("sort") ?? ""],
    ]),
  )

  // 필터를 세션에 저장해 어느 경로로 돌아오든 복원한다.
  // (상품 수정 저장 후 목록으로 갈 때 파라미터가 없어 초기화되던 문제 해결)
  const FKEY = "admin_product_filters"
  useEffect(() => {
    const current = params.toString()
    if (current) {
      sessionStorage.setItem(FKEY, current)
    } else {
      const saved = sessionStorage.getItem(FKEY)
      if (saved) router.replace(`${pathname}?${saved}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function submit() {
    const next = new URLSearchParams()
    for (const [k, v] of Object.entries(draft)) {
      if (v.trim()) next.set(k, v.trim())
    }
    const qs = next.toString()
    if (qs) sessionStorage.setItem(FKEY, qs)
    else sessionStorage.removeItem(FKEY)
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function reset() {
    setDraft(Object.fromEntries(Object.keys(draft).map((k) => [k, ""])))
    sessionStorage.removeItem(FKEY)
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

      {/* 정렬은 고르는 즉시 적용한다. 다른 조건과 달리 하나뿐이라 기다릴 이유가 없다 */}
      <select
        value={draft.sort ?? ""}
        onChange={(e) => {
          const next = { ...draft, sort: e.target.value }
          setDraft(next)
          const qs = new URLSearchParams()
          for (const [k, v] of Object.entries(next)) if (v.trim()) qs.set(k, v.trim())
          const q = qs.toString()
          router.push(q ? `${pathname}?${q}` : pathname)
        }}
        className="h-9 rounded-md border bg-background px-2 text-sm"
      >
        {sorts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

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
