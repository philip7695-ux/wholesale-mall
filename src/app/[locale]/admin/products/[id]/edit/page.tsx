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

  let product, categories
  try {
    ;[product, categories] = await Promise.all([
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
  } catch (err) {
    console.error("[EditProductPage] DB error:", err)
    throw err
  }

  if (!product) notFound()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("editProduct")}</h1>
      <ProductForm
        categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
        initialData={{
          id: product.id,
          code: product.code,
          name: product.name,
          description: product.description,
          categoryId: product.categoryId,
          thumbnail: product.thumbnail,
          images: product.images,
          material: product.material,
          sizeSpec: product.sizeSpec,
          isActive: product.isActive,
          moq: product.moq,
          colorMoq: product.colorMoq,
          colors: product.colors.map((c) => ({ name: c.name, colorCode: c.colorCode, hexColor: c.hexColor, images: c.images, moq: c.moq })),
          sizes: product.sizes.map((s) => ({ name: s.name })),
          variants: product.variants.map((v) => ({ color: { name: v.color.name }, size: { name: v.size.name }, price: v.price, stock: v.stock })),
        }}
      />
    </div>
  )
}
