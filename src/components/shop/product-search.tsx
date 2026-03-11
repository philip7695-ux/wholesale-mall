"use client"

import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search } from "lucide-react"
import { useState } from "react"
import { translateCategory } from "@/lib/translate"

interface Category {
  id: string
  name: string
  slug: string
}

export function ProductSearch({
  categories,
  currentCategory,
  currentSearch,
  currentAgeGroup,
}: {
  categories: Category[]
  currentCategory?: string
  currentSearch?: string
  currentAgeGroup?: string
}) {
  const router = useRouter()
  const t = useTranslations("shop")
  const tc = useTranslations("common")
  const tCat = useTranslations("categories")
  const [search, setSearch] = useState(currentSearch || "")

  function buildUrl(overrides: { category?: string | null; ageGroup?: string | null; search?: string | null }) {
    const params = new URLSearchParams()
    const cat = overrides.category !== undefined ? overrides.category : currentCategory
    const age = overrides.ageGroup !== undefined ? overrides.ageGroup : currentAgeGroup
    const s = overrides.search !== undefined ? overrides.search : (currentSearch || null)
    if (cat) params.set("category", cat)
    if (age) params.set("ageGroup", age)
    if (s) params.set("search", s)
    const qs = params.toString()
    return `/products${qs ? `?${qs}` : ""}`
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    router.push(buildUrl({ search: search || null }))
  }

  return (
    <div className="space-y-3">
      {/* Age group filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={!currentAgeGroup ? "default" : "outline"}
          size="sm"
          onClick={() => router.push(buildUrl({ ageGroup: null }))}
        >
          {tc("all")}
        </Button>
        <Button
          variant={currentAgeGroup === "BABY" ? "default" : "outline"}
          size="sm"
          onClick={() => router.push(buildUrl({ ageGroup: "BABY" }))}
        >
          {t("baby")}
        </Button>
        <Button
          variant={currentAgeGroup === "KIDS" ? "default" : "outline"}
          size="sm"
          onClick={() => router.push(buildUrl({ ageGroup: "KIDS" }))}
        >
          {t("kids")}
        </Button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={!currentCategory ? "default" : "outline"}
          size="sm"
          onClick={() => router.push(buildUrl({ category: null }))}
        >
          {tc("all")}
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={currentCategory === cat.slug ? "default" : "outline"}
            size="sm"
            onClick={() => router.push(buildUrl({ category: cat.slug }))}
          >
            {translateCategory(cat.slug, tCat)}
          </Button>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Button type="submit" size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </form>
    </div>
  )
}
