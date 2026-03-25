"use client"

import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Lock } from "lucide-react"
import { translateCategory } from "@/lib/translate"

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
                {translateCategory(cat.slug, tCat)}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Size */}
      <div>
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-3">{t("size")}</h3>
        <ul className="space-y-2">
          {["S", "M", "L, XL"].map((size) => (
            <li key={size}>
              <button className="text-sm text-gray-500 hover:text-[#1A1A1A] transition-colors">
                {size}
              </button>
            </li>
          ))}
          <li>
            <button className="text-sm text-gray-500 hover:text-[#1A1A1A] transition-colors">
              {t("oneSize")}
            </button>
          </li>
        </ul>
      </div>

      {/* Color */}
      <div>
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-3">{t("color")}</h3>
        <ul className="space-y-2">
          {[
            { name: "Black", hex: "#000000" },
            { name: "White", hex: "#FFFFFF" },
            { name: "Beige", hex: "#D4B896" },
            { name: "Navy", hex: "#1B2A4A" },
            { name: "Red", hex: "#C0392B" },
          ].map((color) => (
            <li key={color.name} className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-full border border-gray-300"
                style={{ backgroundColor: color.hex }}
              />
              <button className="text-sm text-gray-500 hover:text-[#1A1A1A] transition-colors">
                {color.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Price Range */}
      <div>
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-3">{t("priceRange")}</h3>
        <div className="flex items-start gap-2 text-sm text-gray-500">
          <Lock className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{t("loginToViewPrice")}</span>
        </div>
      </div>
    </aside>
  )
}
