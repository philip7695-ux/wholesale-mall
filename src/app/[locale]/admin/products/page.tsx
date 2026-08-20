export const dynamic = 'force-dynamic'

import { Link } from "@/i18n/navigation"
import { prisma } from "@/lib/prisma"
import { getTranslations, getLocale } from "next-intl/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Download, ImageIcon } from "lucide-react"
import { formatPriceCross } from "@/lib/utils"
import { translateCategory } from "@/lib/translate"
import { DeleteProductButton } from "@/components/admin/delete-product-button"
import { ProductBulkUpload } from "@/components/admin/product-bulk-upload"
import { getAllExchangeRates } from "@/lib/currency.server"
import { ProductGrid } from "@/components/admin/product-grid"
import { ProductImageStrip } from "@/components/admin/product-image-strip"
import { ProductSelectCheckbox } from "@/components/admin/product-select-checkbox"
import { ProductActiveToggle } from "@/components/admin/product-active-toggle"
import { ProductFilters } from "@/components/admin/product-filters"
import { YEAR_DIGITS, SEASON_DIGITS, SEASON_KEYS, yearLabel } from "@/lib/season"
import { getSeasonRates } from "@/lib/pricing.server"
import { buyerPrice } from "@/lib/pricing"

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; season?: string; category?: string; brand?: string; code?: string; sort?: string }>
}) {
  const t = await getTranslations("admin")
  const tc = await getTranslations("common")
  const tCat = await getTranslations("categories")
  const locale = await getLocale()
  const rates = await getAllExchangeRates()
  const { year, season, category, brand, code, sort } = await searchParams

  const [categories, brandRows, seasonRates] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({
      where: { brand: { not: null } },
      distinct: ["brand"],
      select: { brand: true },
      orderBy: { brand: "asc" },
    }),
    getSeasonRates(),
  ])

  // 연도·시즌은 seasonKey(코드 3~4번째 두 자리)로 거른다.
  // 둘 다 비면 조건을 걸지 않아 코드 없는 상품도 남는다.
  const where: Record<string, unknown> = {}
  if (year && season) where.seasonKey = `${year}${season}`
  else if (year) where.seasonKey = { startsWith: year }
  else if (season) where.seasonKey = { endsWith: season }
  if (category) where.categoryId = category
  if (brand) where.brand = brand
  // 스타일 넘버는 일부만 넣어도 찾는다
  if (code) where.code = { contains: code, mode: "insensitive" }

  // 재고 많은 순은 스페셜 오퍼로 묶을 대상을 찾을 때 쓴다
  const orderBy =
    sort === "stock"
      ? [{ totalStock: "desc" as const }]
      : [{ seasonKey: "desc" as const }, { code: "asc" as const }]

  const products = await prisma.product.findMany({
    where,
    include: {
      category: true,
      colors: true,
      variants: true,
    },
    orderBy,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("productMgmt")}</h1>
        <div className="flex items-center gap-2">
          <a href="/api/admin/products/export" download>
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
        countLabel={t("filterCount", { count: products.length })}
        searchLabel={t("search")}
        searchPlaceholder={t("codeSearchPlaceholder")}
        sorts={[
          { value: "", label: t("sortSeason") },
          { value: "stock", label: t("sortStock") },
        ]}
      />

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
          labels={{
            selected: t("bulkSelected"),
            activate: t("bulkActivate"),
            deactivate: t("bulkDeactivate"),
            delete: tc("delete"),
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
            // 어드민은 정상가를 다루지만, 바이어에게 얼마로 나가는지도 보여야
            // 할인율 설정이 맞는지 확인할 수 있다. 등급 할인은 회원마다 달라
            // 기준가(BRONZE)만 계산한다.
            const seasonRate = seasonRates[product.seasonKey ?? ""] ?? 0
            const wholesale = minPrice > 0 ? buyerPrice(minPrice, seasonRate, 0) : 0
            const images: string[] = product.images ?? []
            return (
              <Link key={product.id} href={`/admin/products/${product.id}/edit`}>
                <Card className="relative flex flex-col overflow-hidden transition-shadow hover:shadow-md cursor-pointer">
                  <ProductSelectCheckbox id={product.id} label={product.name} />
                  <ProductImageStrip
                    images={images}
                    thumbnail={product.thumbnail}
                    name={product.name}
                    isActive={product.isActive}
                    activeLabel={t("active")}
                    inactiveLabel={t("inactive")}
                    noImageLabel={t("noImage")}
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
    </div>
  )
}
