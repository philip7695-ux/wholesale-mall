export const dynamic = 'force-dynamic'

import { Link } from "@/i18n/navigation"
import { prisma } from "@/lib/prisma"
import { Card, CardContent } from "@/components/ui/card"
import { formatPrice } from "@/lib/utils"
import { ProductSearch } from "@/components/shop/product-search"
import { getTranslations, getLocale } from "next-intl/server"
import { translateCategory } from "@/lib/translate"
import { getExchangeRate } from "@/lib/currency.server"
import { auth } from "@/lib/auth"
import { GRADE_DISCOUNT } from "@/lib/grade"
import { Badge } from "@/components/ui/badge"

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; search?: string; page?: string }>
}) {
  const t = await getTranslations("shop")
  const tCat = await getTranslations("categories")
  const locale = await getLocale()
  const params = await searchParams
  const category = params.category
  const search = params.search
  const page = parseInt(params.page || "1")
  const limit = 20

  const where: Record<string, unknown> = { isActive: true }
  if (category) where.category = { slug: category }
  if (search) where.name = { contains: search, mode: "insensitive" }

  const { rate } = await getExchangeRate(locale)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let session: any = null
  try {
    session = await auth()
  } catch (err) {
    console.error("[ProductsPage] auth() error:", err)
  }
  const buyerGrade = session?.user?.buyerGrade || "BRONZE"
  const discountRate = GRADE_DISCOUNT[buyerGrade] || 0

  let products: any[] = []
  let categories: any[] = []
  let total = 0
  try {
    ;[products, categories, total] = await Promise.all([
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
  } catch (err) {
    console.error("[ProductsPage] DB error:", err)
    throw err
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("productsTitle")}</h1>

      <ProductSearch
        categories={categories.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug }))}
        currentCategory={category}
        currentSearch={search}
      />

      {products.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">{t("noProducts")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product: any) => {
              const minPrice = product.variants.length > 0
                ? Math.min(...product.variants.map((v: any) => v.price))
                : 0
              return (
                <Link key={product.id} href={`/products/${product.id}`}>
                  <Card className="overflow-hidden transition-shadow hover:shadow-md">
                    <div className="aspect-square bg-gray-100">
                      {product.thumbnail ? (
                        <img
                          src={product.thumbnail}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          No Image
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <p className="text-xs text-muted-foreground">{translateCategory(product.category.slug, tCat)}</p>
                      <h3 className="mt-1 text-sm font-medium leading-tight line-clamp-2">
                        {product.name}
                      </h3>
                      <div className="mt-1 flex items-center gap-1">
                        {product.colors.slice(0, 4).map((color: any) => (
                          <span
                            key={color.id}
                            className="inline-block h-3 w-3 rounded-full border"
                            style={{ backgroundColor: color.colorCode || "#ccc" }}
                          />
                        ))}
                        {product.colors.length > 4 && (
                          <span className="text-xs text-muted-foreground">+{product.colors.length - 4}</span>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-bold">
                        {minPrice > 0 ? (
                          discountRate > 0 ? (
                            <>
                              <span className="text-muted-foreground font-normal line-through text-xs">
                                {formatPrice(minPrice, locale, rate)}
                              </span>{" "}
                              <span className="text-primary">
                                {formatPrice(Math.round(minPrice * (1 - discountRate)), locale, rate)}
                              </span>
                            </>
                          ) : (
                            formatPrice(minPrice, locale, rate)
                          )
                        ) : "-"}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/products?${new URLSearchParams({
                    ...(category ? { category } : {}),
                    ...(search ? { search } : {}),
                    page: p.toString(),
                  })}`}
                  className={`flex h-8 w-8 items-center justify-center rounded text-sm ${
                    p === page ? "bg-primary text-primary-foreground" : "border hover:bg-muted"
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
  )
}
