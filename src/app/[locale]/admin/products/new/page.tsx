export const dynamic = 'force-dynamic'

import { prisma } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"
import { ProductForm } from "@/components/admin/product-form"

export default async function NewProductPage() {
  const t = await getTranslations("admin")

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("addProduct")}</h1>
      <ProductForm categories={categories} />
    </div>
  )
}
