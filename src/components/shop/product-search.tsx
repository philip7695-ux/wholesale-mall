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
}: {
  categories: Category[]
  currentCategory?: string
  currentSearch?: string
}) {
  const router = useRouter()
  const t = useTranslations("shop")
  const tc = useTranslations("common")
  const tCat = useTranslations("categories")
  const [search, setSearch] = useState(currentSearch || "")

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (currentCategory) params.set("category", currentCategory)
    if (search) params.set("search", search)
    router.push(`/products?${params.toString()}`)
  }

  return (
    <div className="space-y-3">
      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={!currentCategory ? "default" : "outline"}
          size="sm"
          onClick={() => router.push("/products")}
        >
          {tc("all")}
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={currentCategory === cat.slug ? "default" : "outline"}
            size="sm"
            onClick={() => router.push(`/products?category=${cat.slug}`)}
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
