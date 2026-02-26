export const dynamic = 'force-dynamic'

import { prisma } from "@/lib/prisma"
import { ProductForm } from "@/components/admin/product-form"

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">상품 등록</h1>
      <ProductForm categories={categories} />
    </div>
  )
}
