export const dynamic = 'force-dynamic'

import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ProductDetail } from "@/components/shop/product-detail"

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const raw = await prisma.product.findUnique({
    where: { id, isActive: true },
    include: {
      category: true,
      colors: { orderBy: { sortOrder: "asc" } },
      sizes: { orderBy: { sortOrder: "asc" } },
      variants: { include: { color: true, size: true } },
    },
  })

  if (!raw) notFound()

  // Serialize to plain object to avoid Date/Prisma type serialization issues
  const product = {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    thumbnail: raw.thumbnail,
    images: raw.images,
    sizeSpec: raw.sizeSpec,
    moq: raw.moq,
    colorMoq: raw.colorMoq,
    category: { name: raw.category.name, slug: raw.category.slug },
    colors: raw.colors.map((c) => ({
      id: c.id,
      name: c.name,
      colorCode: c.colorCode,
      images: c.images,
      moq: c.moq,
    })),
    sizes: raw.sizes.map((s) => ({
      id: s.id,
      name: s.name,
    })),
    variants: raw.variants.map((v) => ({
      id: v.id,
      colorId: v.colorId,
      sizeId: v.sizeId,
      price: v.price,
      stock: v.stock,
      color: { id: v.color.id, name: v.color.name },
      size: { id: v.size.id, name: v.size.name },
    })),
  }

  return <ProductDetail product={product} />
}
