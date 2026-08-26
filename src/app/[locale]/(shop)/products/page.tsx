export const dynamic = "force-dynamic"

import { Link } from "@/i18n/navigation"
import { prisma } from "@/lib/prisma"
import { withDbRetry } from "@/lib/db-retry"
import { ProductSearch } from "@/components/shop/product-search"
import { ProductFilterSidebar } from "@/components/shop/product-filter-sidebar"
import { getTranslations, getLocale } from "next-intl/server"
import { translateCategory } from "@/lib/translate"
import { buildProductWhere } from "@/lib/product-filter"
import { AGE_GROUPS } from "@/lib/age-group"
import { seasonsNewestFirst } from "@/lib/season"
import { ProductPrice } from "@/components/shop/product-price"
import { OrderSheetBar } from "@/components/shop/order-sheet-bar"
import { ShopProductGrid } from "@/components/shop/product-grid"
import { paginationRange, ELLIPSIS } from "@/lib/pagination"
import { auth } from "@/lib/auth"
import { getSeasonRates, getSpecialOfferRate } from "@/lib/pricing.server"
import { getGradeDiscount } from "@/lib/grade.server"
import { buyerPrice, seasonRateFor } from "@/lib/pricing"

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; search?: string; page?: string; ageGroup?: string; season?: string; special?: string }>
}) {
  const t = await getTranslations("shop")
  const tCat = await getTranslations("categories")
  const locale = await getLocale()
  const params = await searchParams
  const category = params.category
  const search = params.search
  const ageGroup = params.ageGroup
  // 연도만("6") 고르거나 연도+계절("63")까지 좁힐 수 있다
  const season = params.season
  const specialOnly = params.special === "1"
  const page = parseInt(params.page || "1")
  const limit = 20

  // 홀세일 몰은 카탈로그 성격이므로 재고 0 도 노출한다.
  // 주문 차단은 상세 화면(품절 표시 + 수량 입력 비활성)과
  // 주문 API 의 재고 검증이 담당한다.
  // 필터 조건은 엑셀 주문서 다운로드와 공유한다(lib/product-filter)
  const where = buildProductWhere({ category, season, ageGroup, search, specialOnly })

  // 상품이 없는 시즌은 필터에 띄우지 않는다.
  // 코드를 전부 끌어오면 4,000행이 넘으므로 DB 에서 접두어만 집계한다.
  const seasonRows = await prisma.product
    .findMany({
      where: { isActive: true, seasonKey: { not: null } },
      distinct: ["seasonKey"],
      select: { seasonKey: true },
    })
    .catch(() => [] as { seasonKey: string | null }[])
  const availableSeasons = seasonRows
    .map((r: { seasonKey: string | null }) => r.seasonKey ?? "")
    .filter((k: string) => /^[3-6][1-4]$/.test(k))

  // 가격은 서버에서 계산한다. 화면과 주문이 서로 다른 값을 쓰지 않게 하려는 것이다.
  const session = await auth().catch(() => null)
  const [seasonRates, gradeRate, specialRate] = await Promise.all([
    getSeasonRates(),
    getGradeDiscount(session?.user?.buyerGrade || "BRONZE").catch(() => 0),
    getSpecialOfferRate(),
  ])

  // 스페셜 오퍼가 하나도 없으면 필터에 띄우지 않는다
  const hasSpecialOffers =
    (await prisma.product.count({ where: { isActive: true, specialOffer: true } }).catch(() => 0)) > 0

  let products: any[] = [], categories: any[] = [], total = 0
  let loadError = false
  try {
    ;[products, categories, total] = await withDbRetry(() => Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          colors: { orderBy: { sortOrder: "asc" } },
          variants: true,
        },
        // 품절을 뒤로 보내고 최신 시즌부터 보여준다.
        // createdAt 은 DB 에 넣은 시각이라 시즌 순서와 무관하다.
        // 2023년을 나중에 넣었더니 목록 앞머리가 2023년이 됐다.
        orderBy: [{ inStock: "desc" }, { seasonKey: "desc" }, { code: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.product.count({ where }),
    ]))
  } catch (err) {
    // 일시적 DB 연결 오류 시 전체 페이지 500 대신 안내 메시지로 대체
    console.error("[ProductsPage] DB error:", err)
    loadError = true
  }

  if (loadError) {
    return (
      <div className="py-20 text-center text-gray-400 font-light">
        {t("loadError")}
      </div>
    )
  }

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
            currentSeason={season}
            currentSearch={search}
            availableSeasons={availableSeasons}
            specialOnly={specialOnly}
            hasSpecialOffers={hasSpecialOffers}
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

          {/* 엑셀 일괄 주문: 지금 필터된 상품을 주문서로 받아 수량 채워 업로드 */}
          <OrderSheetBar
            years={[...new Set(availableSeasons.map((s: string) => s[0]))]
              .sort((a, b) => Number(b) - Number(a))
              .map((d) => ({ value: d, label: String(2020 + Number(d)) }))}
            ageGroups={[...AGE_GROUPS]}
            categories={categories.map((c: any) => ({
              value: c.slug,
              label: translateCategory(c.slug, tCat, c.name),
            }))}
          />

          {products.length === 0 ? (
            <p className="py-20 text-center text-gray-400 font-light">{t("noProducts")}</p>
          ) : (
            <>
              <ShopProductGrid>
                {products.map((product: any) => {
                  const minRetail = product.variants.length > 0
                    ? Math.min(...product.variants.map((v: any) => v.price))
                    : 0
                  const price = minRetail > 0
                    ? buyerPrice(
                        minRetail,
                        seasonRateFor(product.code, seasonRates),
                        gradeRate,
                        product.specialOffer ? specialRate : 0,
                      )
                    : 0
                  return (
                    <Link key={product.id} href={`/products/${product.id}`} className="group block">
                      {/* Image */}
                      <div className="relative w-full overflow-hidden bg-white" style={{ paddingBottom: "120%" }}>
                        {product.thumbnail ? (
                          <img
                            src={product.thumbnail}
                            alt={product.name}
                            className="absolute inset-0 h-full w-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
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
                          {translateCategory(product.category.slug, tCat, product.category.name)}
                          <span className="ml-1.5 font-normal normal-case tracking-normal text-gray-400">· {product.code}</span>
                        </p>
                        <h3 className="text-sm text-[#1A1A1A] leading-snug line-clamp-2">
                          {product.name}
                        </h3>
                        <p className="text-sm text-[#1A1A1A] pt-1">
                          <ProductPrice price={price} priceCurrency={product.priceCurrency} />
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </ShopProductGrid>

              {/* Pagination */}
              {totalPages > 1 && (() => {
                // 페이지를 넘길 때 걸어둔 필터가 풀리면 안 된다
                const pageHref = (p: number) =>
                  `/products?${new URLSearchParams({
                    ...(category ? { category } : {}),
                    ...(search ? { search } : {}),
                    ...(ageGroup ? { ageGroup } : {}),
                    ...(season ? { season } : {}),
                    ...(specialOnly ? { special: "1" } : {}),
                    page: p.toString(),
                  })}`
                const arrow =
                  "flex h-9 w-9 items-center justify-center text-sm text-gray-400 transition-colors hover:text-[#1A1A1A]"
                return (
                  <div className="flex items-center justify-center gap-1 pt-10">
                    {page > 1 && (
                      <Link href={pageHref(page - 1)} aria-label="이전" className={arrow}>
                        ‹
                      </Link>
                    )}
                    {paginationRange(page, totalPages).map((p, i) =>
                      p === ELLIPSIS ? (
                        <span
                          key={`gap-${i}`}
                          className="flex h-9 w-9 items-center justify-center text-sm text-gray-300"
                        >
                          {ELLIPSIS}
                        </span>
                      ) : (
                        <Link
                          key={p}
                          href={pageHref(p as number)}
                          className={`flex h-9 w-9 items-center justify-center text-sm transition-colors ${
                            p === page
                              ? "bg-[#1A1A1A] text-white"
                              : "text-gray-400 hover:text-[#1A1A1A]"
                          }`}
                        >
                          {p}
                        </Link>
                      ),
                    )}
                    {page < totalPages && (
                      <Link href={pageHref(page + 1)} aria-label="다음" className={arrow}>
                        ›
                      </Link>
                    )}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
