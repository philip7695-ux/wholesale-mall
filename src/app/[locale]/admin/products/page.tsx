export const dynamic = 'force-dynamic'

import { Link } from "@/i18n/navigation"
import { prisma } from "@/lib/prisma"
import { getTranslations, getLocale } from "next-intl/server"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { translateCategory } from "@/lib/translate"
import { DeleteProductButton } from "@/components/admin/delete-product-button"
import { ProductBulkUpload } from "@/components/admin/product-bulk-upload"
import { getExchangeRate } from "@/lib/currency.server"

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
        <Link href="/admin/products/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {t("addProduct")}
          </Button>
        </Link>
      </div>

      <ProductBulkUpload />

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("noProducts")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {products.map((product: any) => {
            const minPrice = product.variants.length > 0
              ? Math.min(...product.variants.map((v: any) => v.price))
              : 0
            return (
              <Card key={product.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-3">
                    {product.thumbnail && (
                      <img
                        src={product.thumbnail}
                        alt={product.name}
                        className="h-12 w-12 rounded object-cover"
                      />
                    )}
                    <div>
                      <CardTitle className="text-base">{product.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {translateCategory(product.category.slug, tCat)} | {product.colors.length}{t("colors")} | {product.variants.length}{t("skus")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={product.isActive ? "default" : "secondary"}>
                      {product.isActive ? t("active") : t("inactive")}
                    </Badge>
                    <span className="text-sm font-medium">
                      {minPrice > 0 ? formatPrice(minPrice, locale, rate) : "-"}~
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex justify-end gap-2 pt-0">
                  <Link href={`/admin/products/${product.id}/edit`}>
                    <Button variant="outline" size="sm">{tc("edit")}</Button>
                  </Link>
                  <DeleteProductButton productId={product.id} productName={product.name} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
