export const dynamic = 'force-dynamic'

import { Link } from "@/i18n/navigation"
import { prisma } from "@/lib/prisma"
import { getTranslations, getLocale } from "next-intl/server"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Download } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { translateCategory } from "@/lib/translate"
import { DeleteProductButton } from "@/components/admin/delete-product-button"
import { ProductBulkUpload } from "@/components/admin/product-bulk-upload"
import { getExchangeRate } from "@/lib/currency.server"
import { ProductGrid } from "@/components/admin/product-grid"

export default async function AdminProductsPage() {
  const t = await getTranslations("admin")
  const tc = await getTranslations("common")
  const tCat = await getTranslations("categories")
  const locale = await getLocale()
  const { rate } = await getExchangeRate(locale)

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
        <ProductGrid>
          {products.map((product: any) => {
            const minPrice = product.variants.length > 0
              ? Math.min(...product.variants.map((v: any) => v.price))
              : 0
            const imgSrc = product.thumbnail || product.images?.[0]
            return (
              <Card key={product.id} className="flex flex-col overflow-hidden">
                {imgSrc ? (
                  <div className="relative w-full overflow-hidden rounded-t-lg" style={{ paddingBottom: "100%" }}>
                    <img
                      src={imgSrc}
                      alt={product.name}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <Badge
                      variant={product.isActive ? "default" : "secondary"}
                      className="absolute top-2 right-2"
                    >
                      {product.isActive ? t("active") : t("inactive")}
                    </Badge>
                  </div>
                ) : (
                  <div className="relative w-full rounded-t-lg bg-muted" style={{ paddingBottom: "100%" }}>
                    <span className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">{t("noImage") || "No Image"}</span>
                    <Badge
                      variant={product.isActive ? "default" : "secondary"}
                      className="absolute top-2 right-2"
                    >
                      {product.isActive ? t("active") : t("inactive")}
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-2 pt-3">
                  {product.code && (
                    <p className="text-xs font-mono text-muted-foreground">{product.code}</p>
                  )}
                  <CardTitle className="text-sm font-semibold line-clamp-1">{product.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {translateCategory(product.category.slug, tCat)} | {product.colors.length}{t("colors")} | {product.variants.length}{t("skus")}
                  </p>
                  <p className="text-sm font-medium mt-1">
                    {minPrice > 0 ? formatPrice(minPrice, locale, rate) : "-"}~
                  </p>
                </CardHeader>
                <CardContent className="mt-auto flex gap-2 pt-0">
                  <Link href={`/admin/products/${product.id}/edit`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">{tc("edit")}</Button>
                  </Link>
                  <DeleteProductButton productId={product.id} productName={product.name} />
                </CardContent>
              </Card>
            )
          })}
        </ProductGrid>
      )}
    </div>
  )
}
