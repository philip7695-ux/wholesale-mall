export const dynamic = 'force-dynamic'

import { Link } from "@/i18n/navigation"
import { prisma } from "@/lib/prisma"
import { getTranslations, getLocale } from "next-intl/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Download, ImageIcon } from "lucide-react"
import { formatPriceCross } from "@/lib/utils"
import { translateCategory } from "@/lib/translate"
import { sortSizeNames } from "@/lib/product-sizes"
import { DeleteProductButton } from "@/components/admin/delete-product-button"
import { ProductBulkUpload } from "@/components/admin/product-bulk-upload"
import { getAllExchangeRates } from "@/lib/currency.server"
import { ProductGrid } from "@/components/admin/product-grid"
import { ProductImageStrip } from "@/components/admin/product-image-strip"
import { ProductSelectCheckbox } from "@/components/admin/product-select-checkbox"
import { ProductActiveToggle } from "@/components/admin/product-active-toggle"
import { ProductFilters } from "@/components/admin/product-filters"
import { YEAR_DIGITS, SEASON_DIGITS, SEASON_KEYS, yearLabel } from "@/lib/season"
import { getSeasonRates, getSpecialOfferRate } from "@/lib/pricing.server"
import { buyerPrice } from "@/lib/pricing"
import { paginationRange, ELLIPSIS } from "@/lib/pagination"
import { buildAdminProductWhere } from "@/lib/product-filter"

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; season?: string; category?: string; brand?: string; code?: string; sort?: string; page?: string }>
}) {
  const t = await getTranslations("admin")
  const tc = await getTranslations("common")
  const tCat = await getTranslations("categories")
  const locale = await getLocale()
  const rates = await getAllExchangeRates()
  const { year, season, category, brand, code, sort } = await searchParams
  const page = Math.max(1, parseInt((await searchParams).page || "1"))

  const [categories, brandRows, seasonRates, specialOfferRate] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({
      where: { brand: { not: null } },
      distinct: ["brand"],
      select: { brand: true },
      orderBy: { brand: "asc" },
    }),
    getSeasonRates(),
    getSpecialOfferRate(),
  ])

  // 조건 빌드는 엑셀 내보내기와 공유한다(같은 필터 = 같은 결과)
  const where = buildAdminProductWhere({ year, season, category, brand, code })

  // 재고 많은 순은 스페셜 오퍼로 묶을 대상을 찾을 때 쓴다
  const orderBy =
    sort === "stock"
      ? [{ totalStock: "desc" as const }]
      : [{ seasonKey: { sort: "desc" as const, nulls: "last" as const } }, { code: "asc" as const }]

  // "사진 없는 상품"은 정렬 자리에 있지만 실제로는 거름망이다.
  // 사진 안 올라간 상품만 추려 채워 넣는 작업용.
  if (sort === "nophoto") {
    where.OR = [{ thumbnail: null }, { thumbnail: "" }]
  }

  // 조건 없이 4,550개를 전부 부르면 조회에만 2.5초가 걸리고 카드도 그만큼
  // 그려야 한다. 아무것도 안 걸었으면 첫 장만 보여주고, 조건을 걸었으면
  // (이미 좁혔다는 뜻이므로) 걸린 것을 다 보여준다.
  const hasFilter = Boolean(year || season || category || brand || code || sort === "nophoto")
  const PAGE_SIZE = 20
  const FILTERED_MAX = 600   // 조건을 걸어도 이만큼 넘으면 더 좁히도록 안내한다

  const total = await prisma.product.count({ where })
  // 전체 선택은 화면(페이지)이 아니라 필터 조건 전체를 대상으로 한다.
  // id 만 뽑으므로 수천 개여도 가볍다.
  const allIdRows = await prisma.product.findMany({ where, select: { id: true } })
  const take = hasFilter ? FILTERED_MAX : PAGE_SIZE
  const skip = hasFilter ? 0 : (page - 1) * PAGE_SIZE

  const products = await prisma.product.findMany({
    where,
    include: {
      category: true,
      colors: true,
      variants: true,
      sizes: true,
    },
    orderBy,
    skip,
    take,
  })

  const totalPages = hasFilter ? 1 : Math.ceil(total / PAGE_SIZE)
  const capped = hasFilter && total > FILTERED_MAX

  // 엑셀 다운로드도 화면과 같은 필터 조건으로 받는다
  const exportQs = new URLSearchParams()
  for (const [k, v] of Object.entries({ year, season, category, brand, code })) {
    if (v) exportQs.set(k, v)
  }
  const exportHref = `/api/admin/products/export${exportQs.toString() ? `?${exportQs}` : ""}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("productMgmt")}</h1>
        <div className="flex items-center gap-2">
          <a href={exportHref} download>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              {t("exportExcel") || "Excel"}
            </Button>
          </a>
          <Link href="/admin/products/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("addProduct")}
            </Button>
          </Link>
        </div>
      </div>

      <ProductBulkUpload />

      <ProductFilters
        brands={brandRows.map((b: any) => ({ value: b.brand, label: b.brand }))}
        years={YEAR_DIGITS.map((d) => ({ value: d, label: yearLabel(d) }))}
        seasons={SEASON_DIGITS.map((d) => ({ value: d, label: t(SEASON_KEYS[d]) }))}
        categories={categories.map((c: any) => ({
          value: c.id,
          label: translateCategory(c.slug, tCat, c.name),
        }))}
        allLabel={t("filterAll")}
        resetLabel={t("filterReset")}
        countLabel={t("filterCount", { count: total })}
        searchLabel={t("search")}
        searchPlaceholder={t("codeSearchPlaceholder")}
        sorts={[
          { value: "", label: t("sortSeason") },
          { value: "stock", label: t("sortStock") },
          { value: "nophoto", label: t("sortNoPhoto") },
        ]}
      />

      {capped && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t("filterCapped", { shown: products.length, total })}
        </p>
      )}

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("noProducts")}
          </CardContent>
        </Card>
      ) : (
        <ProductGrid
          allImagesLabel={t("allImages")}
          mainImageLabel={t("mainImage")}
          allIds={allIdRows.map((p) => p.id)}
          labels={{
            selected: t("bulkSelected"),
            selectAll: t("bulkSelectAll"),
            activate: t("bulkActivate"),
            deactivate: t("bulkDeactivate"),
            delete: tc("delete"),
            special: t("bulkSpecial"),
            unspecial: t("bulkUnspecial"),
            clear: t("bulkClear"),
            deleteConfirm: t("bulkDeleteConfirm"),
            orderedWarning: t("bulkOrderedWarning"),
            done: t("bulkDone"),
            failed: t("saveFailed"),
          }}
        >
          {products.map((product: any) => {
            const prices = product.variants.map((v: any) => v.price)
            const minPrice = prices.length > 0 ? Math.min(...prices) : 0
            const hasPriceRange = prices.length > 0 && Math.max(...prices) !== minPrice
            // 사이즈 레인지: 사이즈를 정렬해 최소~최대로 보여준다(한 개면 그대로)
            const sortedSizes = sortSizeNames(product.sizes.map((s: any) => s.name))
            const sizeRange =
              sortedSizes.length === 0
                ? ""
                : sortedSizes.length === 1
                  ? sortedSizes[0]
                  : `${sortedSizes[0]}~${sortedSizes[sortedSizes.length - 1]}`
            // 어드민은 정상가를 다루지만, 바이어에게 얼마로 나가는지도 보여야
            // 할인율 설정이 맞는지 확인할 수 있다. 등급 할인은 회원마다 달라
            // 기준가(BRONZE)만 계산한다.
            const sk = product.seasonKey ?? ""
            const seasonRate =
              (product.brand ? seasonRates[`${product.brand}:${sk}`] : undefined) ??
              seasonRates[sk] ?? 0
            const specialRate = product.specialOffer ? specialOfferRate : 0
            const wholesale = minPrice > 0 ? buyerPrice(minPrice, seasonRate, 0, specialRate) : 0
            const images: string[] = product.images ?? []
            return (
              <Link key={product.id} href={`/admin/products/${product.id}/edit`}>
                <Card className="relative flex flex-col overflow-hidden transition-shadow hover:shadow-md cursor-pointer">
                  <ProductSelectCheckbox id={product.id} label={product.name} />
                  <ProductImageStrip
                    productId={product.id}
                    images={images}
                    thumbnail={product.thumbnail}
                    name={product.name}
                    isActive={product.isActive}
                    activeLabel={t("active")}
                    inactiveLabel={t("inactive")}
                    noImageLabel={t("noImage")}
                    deleteConfirmLabel={t("imageDeleteConfirm")}
                    deleteFailLabel={t("imageDeleteFail")}
                  />
                  <CardHeader className="pb-2 pt-3">
                    <div className="flex items-center justify-between gap-2">
                      {product.code && (
                        <p className="text-xs font-mono text-muted-foreground">{product.code}</p>
                      )}
                      {/* 사진 장수. 3장이 아닌 상품을 목록에서 바로 걸러내기 위한 것이다.
                          0 장일 때는 이미지 자리에 "사진 없음" 이 이미 나오므로 감춘다. */}
                      {images.length > 0 && (
                        <span
                          className="flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground"
                          title={t("imageCountTitle")}
                        >
                          <ImageIcon className="h-3 w-3" />
                          {images.length}
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-sm font-semibold line-clamp-1">{product.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {translateCategory(product.category.slug, tCat, product.category.name)} | {product.colors.length}{t("colors")} | {product.variants.length}{t("skus")}
                      {sizeRange && <> | {sizeRange}</>}
                    </p>
                    {/* 재고가 많은 상품을 골라 스페셜 오퍼로 묶기 위한 표시 */}
                    <p className="text-xs">
                      {product.totalStock > 0 ? (
                        <span className={product.totalStock >= 500 ? "font-medium text-emerald-600" : "text-muted-foreground"}>
                          {t("stockTotal", { count: product.totalStock.toLocaleString() })}
                        </span>
                      ) : (
                        <span className="text-red-500">{t("outOfStock")}</span>
                      )}
                    </p>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-sm font-medium">
                        {wholesale > 0 ? formatPriceCross(wholesale, product.priceCurrency, locale, rates) : "-"}
                        {hasPriceRange && "~"}
                      </span>
                      {seasonRate > 0 && minPrice > 0 && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatPriceCross(minPrice, product.priceCurrency, locale, rates)}
                        </span>
                      )}
                      {seasonRate > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          -{Math.round(seasonRate * 100)}%
                          {specialRate > 0 && ` -${Math.round(specialRate * 100)}%`}
                        </span>
                      )}
                      {product.specialOffer && (
                        <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800">
                          {t("specialOffer")}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="mt-auto flex gap-2 pt-0">
                    <ProductActiveToggle
                      productId={product.id}
                      isActive={product.isActive}
                      activeLabel={t("active")}
                      inactiveLabel={t("inactive")}
                    />
                    <DeleteProductButton productId={product.id} productName={product.name} />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </ProductGrid>
      )}

      {/* 조건을 걸면 걸린 것을 다 보여주므로 페이지가 필요 없다 */}
      {!hasFilter && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-4">
          {page > 1 && (
            <Link
              href={`/admin/products?page=${page - 1}${sort ? `&sort=${sort}` : ""}`}
              className="flex h-9 w-9 items-center justify-center text-sm text-muted-foreground hover:text-foreground"
            >
              ‹
            </Link>
          )}
          {paginationRange(page, totalPages).map((p, i) =>
            p === ELLIPSIS ? (
              <span key={`gap-${i}`} className="flex h-9 w-9 items-center justify-center text-sm text-muted-foreground/50">
                {ELLIPSIS}
              </span>
            ) : (
              <Link
                key={p}
                href={`/admin/products?page=${p}${sort ? `&sort=${sort}` : ""}`}
                className={`flex h-9 w-9 items-center justify-center rounded-md text-sm transition-colors ${
                  p === page ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </Link>
            ),
          )}
          {page < totalPages && (
            <Link
              href={`/admin/products?page=${page + 1}${sort ? `&sort=${sort}` : ""}`}
              className="flex h-9 w-9 items-center justify-center text-sm text-muted-foreground hover:text-foreground"
            >
              ›
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
