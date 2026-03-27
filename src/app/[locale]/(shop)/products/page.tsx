export const revalidate = 60

import { Link } from "@/i18n/navigation"
import { prisma } from "@/lib/prisma"
import { ProductSearch } from "@/components/shop/product-search"
import { ProductFilterSidebar } from "@/components/shop/product-filter-sidebar"
import { getTranslations, getLocale } from "next-intl/server"
import { translateCategory } from "@/lib/translate"
import { ProductPrice } from "@/components/shop/product-price"
import { ShopProductGrid } from "@/components/shop/product-grid"

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; search?: string; page?: string; ageGroup?: string }>
}) {
  const t = await getTranslations("shop")
  const tCat = await getTranslations("categories")
  const locale = await getLocale()
  const params = await searchParams
  const category = params.category
  const search = params.search
  const ageGroup = params.ageGroup
  const page = parseInt(params.page || "1")
  const limit = 20

  const where: Record<string, unknown> = {
    isActive: true,
    variants: { some: { stock: { gt: 0 } } },
  }
  if (category) where.category = { slug: category }
  if (ageGroup === "BABY" || ageGroup === "KIDS") where.ageGroup = ageGroup
  if (search) where.OR = [
    { name: { contains: search, mode: "insensitive" } },
    { code: { contains: search, mode: "insensitive" } },
  ]

  const [products, categories, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        colors: { orderBy: { sortOrder: "asc" } },
        variants: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.product.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      {/* Title */}
      <h1 className="mb-8 text-2xl font-semibold text-[#1A1A1A]">{t("curatedSelection")}</h1>

      {/* Main: sidebar + grid */}
      <div className="flex gap-10">
        {/* Left filter sidebar - desktop only */}
        <div className="hidden lg:block">
          <ProductFilterSidebar
            categories={categories.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug }))}
            currentCategory={category}
            currentAgeGroup={ageGroup}
          />
        </div>

        {/* Right content */}
        <div className="flex-1 min-w-0">
          {/* Mobile search + filter */}
          <div className="lg:hidden mb-6">
            <ProductSearch
              categories={categories.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug }))}
              currentCategory={category}
              currentSearch={search}
              currentAgeGroup={ageGroup}
            />
          </div>

          {products.length === 0 ? (
            <p className="py-20 text-center text-gray-400 font-light">{t("noProducts")}</p>
          ) : (
            <>
              <ShopProductGrid>
                {products.map((product: any) => {
                  const minPrice = product.variants.length > 0
                    ? Math.min(...product.variants.map((v: any) => v.price))
                    : 0
                  return (
                    <Link key={product.id} href={`/products/${product.id}`} className="group block">
                      {/* Image */}
                      <div className="relative w-full overflow-hidden bg-[#F0EEEB]" style={{ paddingBottom: "120%" }}>
                        {product.thumbnail ? (
                          <img
                            src={product.thumbnail}
                            alt={product.name}
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-sm">
                            No Image
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="mt-3 space-y-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">
                          {translateCategory(product.category.slug, tCat)}
                        </p>
                        <h3 className="text-sm text-[#1A1A1A] leading-snug line-clamp-2">
                          {product.name}
                        </h3>
                        <p className="text-sm text-[#1A1A1A] pt-1">
                          <ProductPrice minPrice={minPrice} priceCurrency={product.priceCurrency} />
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </ShopProductGrid>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-10">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Link
                      key={p}
                      href={`/products?${new URLSearchParams({
                        ...(category ? { category } : {}),
                        ...(search ? { search } : {}),
                        page: p.toString(),
                      })}`}
                      className={`flex h-9 w-9 items-center justify-center text-sm transition-colors ${
                        p === page
                          ? "bg-[#1A1A1A] text-white"
                          : "text-gray-400 hover:text-[#1A1A1A]"
                      }`}
                    >
                      {p}
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
