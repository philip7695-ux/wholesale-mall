"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { Search } from "lucide-react"
import { useTranslations } from "next-intl"
import { translateCategory } from "@/lib/translate"
import { AGE_GROUPS, AGE_GROUP_KEYS } from "@/lib/age-group"
import { seasonsNewestFirst, SEASON_KEYS } from "@/lib/season"

interface Category {
  id: string
  name: string
  slug: string
}

export function ProductFilterSidebar({
  categories,
  currentCategory,
  currentAgeGroup,
  currentSeason,
  currentSearch,
  availableSeasons,
  specialOnly,
  hasSpecialOffers,
}: {
  categories: Category[]
  currentCategory?: string
  currentAgeGroup?: string
  currentSeason?: string
  currentSearch?: string
  availableSeasons: string[]
  specialOnly: boolean
  hasSpecialOffers: boolean
}) {
  const router = useRouter()
  const [searchDraft, setSearchDraft] = useState(currentSearch ?? "")
  const t = useTranslations("shop")
  const tc = useTranslations("common")
  const tCat = useTranslations("categories")

  function buildUrl(overrides: {
    category?: string | null
    ageGroup?: string | null
    season?: string | null
    special?: boolean | null
  }) {
    const params = new URLSearchParams()
    const cat = overrides.category !== undefined ? overrides.category : currentCategory
    const age = overrides.ageGroup !== undefined ? overrides.ageGroup : currentAgeGroup
    const sea = overrides.season !== undefined ? overrides.season : currentSeason
    if (cat) params.set("category", cat)
    if (age) params.set("ageGroup", age)
    if (sea) params.set("season", sea)
    const sp = overrides.special !== undefined ? overrides.special : specialOnly
    if (sp) params.set("special", "1")
    if (currentSearch) params.set("search", currentSearch)
    const qs = params.toString()
    return `/products${qs ? `?${qs}` : ""}`
  }

  // 상품이 있는 시즌만 남겨 연도별로 묶는다(최신순)
  const years: { year: string; seasons: { key: string; season: string }[] }[] = []
  for (const s of seasonsNewestFirst()) {
    if (!availableSeasons.includes(s.key)) continue
    const found = years.find((y) => y.year === s.year)
    if (found) found.seasons.push({ key: s.key, season: s.season })
    else years.push({ year: s.year, seasons: [{ key: s.key, season: s.season }] })
  }

  function runSearch() {
    const params = new URLSearchParams()
    if (searchDraft.trim()) params.set("search", searchDraft.trim())
    if (currentCategory) params.set("category", currentCategory)
    if (currentAgeGroup) params.set("ageGroup", currentAgeGroup)
    if (currentSeason) params.set("season", currentSeason)
    if (specialOnly) params.set("special", "1")
    const qs = params.toString()
    router.push(`/products${qs ? `?${qs}` : ""}`)
  }

  return (
    <aside className="w-52 flex-shrink-0 space-y-8">
      {/* 품번·상품명 검색. 도매 바이어는 라인시트 보고 품번으로 찾는다. */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          runSearch()
        }}
        className="relative"
      >
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder={t("searchByCodeOrName")}
          className="w-full rounded-md border border-gray-200 bg-white py-2 pl-8 pr-2 text-sm text-[#1A1A1A] placeholder:text-gray-400 focus:border-[#1A1A1A] focus:outline-none transition-colors"
        />
      </form>
      {/* Special offer — 카테고리가 아니라 딱지라 맨 위에 따로 둔다 */}
      {hasSpecialOffers && (
        <button
          onClick={() => router.push(buildUrl({ special: !specialOnly }))}
          className={`block w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
            specialOnly
              ? "border-[#1A1A1A] bg-[#1A1A1A] font-medium text-white"
              : "border-gray-200 text-[#1A1A1A] hover:border-[#1A1A1A]"
          }`}
        >
          {t("specialOffer")}
        </button>
      )}

      {/* Season */}
      {availableSeasons.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-[#1A1A1A] mb-3">{t("season")}</h3>
          <ul className="space-y-2">
            <li>
              <button
                onClick={() => router.push(buildUrl({ season: null }))}
                className={`text-sm transition-colors ${
                  !currentSeason
                    ? "text-[#1A1A1A] font-medium"
                    : "text-gray-500 hover:text-[#1A1A1A]"
                }`}
              >
                {tc("all")}
              </button>
            </li>
            {/* 시즌이 16개라 전부 펼치면 목록이 화면을 넘긴다.
                연도만 두고, 고른 해의 계절만 아래에 펼친다. */}
            {years.map((y) => {
              const open = currentSeason?.startsWith(y.year)
              return (
                <li key={y.year}>
                  <button
                    onClick={() =>
                      router.push(buildUrl({ season: currentSeason === y.year ? null : y.year }))
                    }
                    className={`text-sm transition-colors ${
                      open ? "text-[#1A1A1A] font-medium" : "text-gray-500 hover:text-[#1A1A1A]"
                    }`}
                  >
                    {2020 + Number(y.year)}
                  </button>
                  {open && (
                    <ul className="mt-1.5 space-y-1.5 pl-3">
                      {y.seasons.map((sn) => (
                        <li key={sn.key}>
                          <button
                            onClick={() =>
                              router.push(
                                buildUrl({ season: currentSeason === sn.key ? y.year : sn.key }),
                              )
                            }
                            className={`text-sm transition-colors ${
                              currentSeason === sn.key
                                ? "text-[#1A1A1A] font-medium"
                                : "text-gray-400 hover:text-[#1A1A1A]"
                            }`}
                          >
                            {t(SEASON_KEYS[sn.season])}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Age group */}
      <div>
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-3">{t("ageGroup")}</h3>
        <ul className="space-y-2">
          <li>
            <button
              onClick={() => router.push(buildUrl({ ageGroup: null }))}
              className={`text-sm transition-colors ${
                !currentAgeGroup
                  ? "text-[#1A1A1A] font-medium"
                  : "text-gray-500 hover:text-[#1A1A1A]"
              }`}
            >
              {tc("all")}
            </button>
          </li>
          {AGE_GROUPS.map((age) => (
            <li key={age}>
              <button
                onClick={() =>
                  router.push(buildUrl({ ageGroup: currentAgeGroup === age ? null : age }))
                }
                className={`text-sm transition-colors ${
                  currentAgeGroup === age
                    ? "text-[#1A1A1A] font-medium"
                    : "text-gray-500 hover:text-[#1A1A1A]"
                }`}
              >
                {t(AGE_GROUP_KEYS[age])}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Category */}
      <div>
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-3">{t("category")}</h3>
        <ul className="space-y-2">
          <li>
            <button
              onClick={() => router.push(buildUrl({ category: null }))}
              className={`text-sm transition-colors ${
                !currentCategory
                  ? "text-[#1A1A1A] font-medium"
                  : "text-gray-500 hover:text-[#1A1A1A]"
              }`}
            >
              {tc("all")}
            </button>
          </li>
          {categories.map((cat) => (
            <li key={cat.id}>
              <button
                onClick={() => router.push(buildUrl({ category: currentCategory === cat.slug ? null : cat.slug }))}
                className={`text-sm transition-colors ${
                  currentCategory === cat.slug
                    ? "text-[#1A1A1A] font-medium"
                    : "text-gray-500 hover:text-[#1A1A1A]"
                }`}
              >
                {translateCategory(cat.slug, tCat, cat.name)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
