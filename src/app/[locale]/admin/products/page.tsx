export const dynamic = 'force-dynamic'

import { Link } from "@/i18n/navigation"
import { prisma } from "@/lib/prisma"
import { getTranslations, getLocale } from "next-intl/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Download } from "lucide-react"
import { formatPriceCross } from "@/lib/utils"
import { translateCategory } from "@/lib/translate"
import { DeleteProductButton } from "@/components/admin/delete-product-button"
import { ProductBulkUpload } from "@/components/admin/product-bulk-upload"
import { getAllExchangeRates } from "@/lib/currency.server"
import { ProductGrid } from "@/components/admin/product-grid"
import { ProductImageStrip } from "@/components/admin/product-image-strip"

export default async function AdminProductsPage() {
  const t = await getTranslations("admin")
  const tc = await getTranslations("common")
  const tCat = await getTranslations("categories")
  const locale = await getLocale()
  const rates = await getAllExchangeRates()

  const products = await prisma.product.findMany({
    include: {
      category: true,
      colors: true,
      variants: true,
    },
    orderBy: { createdAt: "desc" },
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

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("noProducts")}
          </CardContent>
        </Card>
      ) : (
        <ProductGrid allImagesLabel={t("allImages")} mainImageLabel={t("mainImage")}>
          {products.map((product: any) => {
            const minPrice = product.variants.length > 0
              ? Math.min(...product.variants.map((v: any) => v.price))
              : 0
            const images: string[] = product.images ?? []
            return (
              <Link key={product.id} href={`/admin/products/${product.id}/edit`}>
                <Card className="flex flex-col overflow-hidden transition-shadow hover:shadow-md cursor-pointer">
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
                      {/* 사진 장수를 함께 보여 3장이 아닌 상품을 바로 걸러낼 수 있게 한다 */}
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {images.length}{t("imageCount")}
                      </span>
                    </div>
                    <CardTitle className="text-sm font-semibold line-clamp-1">{product.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {translateCategory(product.category.slug, tCat, product.category.name)} | {product.colors.length}{t("colors")} | {product.variants.length}{t("skus")}
                    </p>
                    <p className="text-sm font-medium mt-1">
                      {minPrice > 0 ? formatPriceCross(minPrice, product.priceCurrency, locale, rates) : "-"}~
                    </p>
                  </CardHeader>
                  <CardContent className="mt-auto flex gap-2 pt-0">
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
