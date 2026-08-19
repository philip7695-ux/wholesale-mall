"use client"

import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { translateCategory } from "@/lib/translate"
import { AGE_GROUPS, AGE_GROUP_KEYS } from "@/lib/age-group"

interface Category {
  id: string
  name: string
  slug: string
}

export function ProductFilterSidebar({
  categories,
  currentCategory,
  currentAgeGroup,
}: {
  categories: Category[]
  currentCategory?: string
  currentAgeGroup?: string
}) {
  const router = useRouter()
  const t = useTranslations("shop")
  const tc = useTranslations("common")
  const tCat = useTranslations("categories")

  function buildUrl(overrides: { category?: string | null; ageGroup?: string | null }) {
    const params = new URLSearchParams()
    const cat = overrides.category !== undefined ? overrides.category : currentCategory
    const age = overrides.ageGroup !== undefined ? overrides.ageGroup : currentAgeGroup
    if (cat) params.set("category", cat)
    if (age) params.set("ageGroup", age)
    const qs = params.toString()
    return `/products${qs ? `?${qs}` : ""}`
  }

  return (
    <aside className="w-52 flex-shrink-0 space-y-8">
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
