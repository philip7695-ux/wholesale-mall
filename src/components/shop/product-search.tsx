"use client"

import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
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
    <div className="space-y-5">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" />
        <input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border-b border-gray-200 bg-transparent py-2.5 pl-10 pr-4 text-sm text-[#1A1A1A] placeholder:text-gray-300 focus:border-[#1A1A1A] focus:outline-none transition-colors"
        />
      </form>

      {/* Age group filter */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => router.push(buildUrl({ ageGroup: null }))}
          className={`text-xs uppercase tracking-[0.15em] transition-colors ${
            !currentAgeGroup ? "text-[#1A1A1A] font-medium" : "text-gray-400 hover:text-[#1A1A1A]"
          }`}
        >
          {tc("all")}
        </button>
        <span className="text-gray-200">|</span>
        <button
          onClick={() => router.push(buildUrl({ ageGroup: "BABY" }))}
          className={`text-xs uppercase tracking-[0.15em] transition-colors ${
            currentAgeGroup === "BABY" ? "text-[#1A1A1A] font-medium" : "text-gray-400 hover:text-[#1A1A1A]"
          }`}
        >
          {t("baby")}
        </button>
        <span className="text-gray-200">|</span>
        <button
          onClick={() => router.push(buildUrl({ ageGroup: "KIDS" }))}
          className={`text-xs uppercase tracking-[0.15em] transition-colors ${
            currentAgeGroup === "KIDS" ? "text-[#1A1A1A] font-medium" : "text-gray-400 hover:text-[#1A1A1A]"
          }`}
        >
          {t("kids")}
        </button>
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => router.push(buildUrl({ category: null }))}
          className={`text-xs uppercase tracking-[0.1em] transition-colors ${
            !currentCategory ? "text-[#1A1A1A] font-medium border-b border-[#1A1A1A] pb-0.5" : "text-gray-400 hover:text-[#1A1A1A]"
          }`}
        >
          {tc("all")}
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => router.push(buildUrl({ category: cat.slug }))}
            className={`text-xs uppercase tracking-[0.1em] transition-colors ${
              currentCategory === cat.slug ? "text-[#1A1A1A] font-medium border-b border-[#1A1A1A] pb-0.5" : "text-gray-400 hover:text-[#1A1A1A]"
            }`}
          >
            {translateCategory(cat.slug, tCat)}
          </button>
        ))}
      </div>
    </div>
  )
}
