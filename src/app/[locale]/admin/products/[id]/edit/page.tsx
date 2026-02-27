export const dynamic = 'force-dynamic'

import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"
import { ProductForm } from "@/components/admin/product-form"

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const t = await getTranslations("admin")
  const { id } = await params
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        colors: { orderBy: { sortOrder: "asc" } },
        sizes: { orderBy: { sortOrder: "asc" } },
        variants: { include: { color: true, size: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ])

  if (!product) notFound()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("editProduct")}</h1>
      <ProductForm categories={categories} initialData={product} />
    </div>
  )
}
