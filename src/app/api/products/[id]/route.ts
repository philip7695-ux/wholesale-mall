import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      colors: { orderBy: { sortOrder: "asc" } },
      sizes: { orderBy: { sortOrder: "asc" } },
      variants: {
        include: { color: true, size: true },
      },
    },
  })

  if (!product) {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 })
  }

  return NextResponse.json(product)
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { name, code, description, categoryId, thumbnail, images, material, sizeSpec, isActive, moq, colorMoq, priceCurrency, colors, sizes, variants } = body

  try {
    // Update basic product info
    await prisma.product.update({
      where: { id },
      data: { name, code: code !== undefined ? (code || null) : undefined, description, categoryId, thumbnail, images: images || [], material: material !== undefined ? (material || null) : undefined, sizeSpec: sizeSpec || null, isActive, moq: moq ?? undefined, colorMoq: colorMoq ?? undefined, priceCurrency: priceCurrency || undefined },
    })

    // Delete cart items referencing this product's variants (to avoid FK constraint)
    await prisma.cartItem.deleteMany({ where: { variant: { productId: id } } })

    // Replace colors, sizes, and variants
    if (colors !== undefined) {
      await prisma.productColor.deleteMany({ where: { productId: id } })
      if (colors.length > 0) {
        await prisma.productColor.createMany({
          data: colors.map((c: { name: string; colorCode?: string; hexColor?: string; images?: string[]; sortOrder?: number; moq?: number }, i: number) => ({
            productId: id,
            name: c.name,
            colorCode: c.colorCode || null,
            hexColor: c.hexColor || null,
            images: c.images || [],
            sortOrder: c.sortOrder ?? i,
            moq: c.moq ?? 0,
          })),
        })
      }
    }

    if (sizes !== undefined) {
      await prisma.productSize.deleteMany({ where: { productId: id } })
      if (sizes.length > 0) {
        await prisma.productSize.createMany({
          data: sizes.map((s: { name: string; sortOrder?: number }, i: number) => ({
            productId: id,
            name: s.name,
            sortOrder: s.sortOrder ?? i,
          })),
        })
      }
    }

    if (variants !== undefined) {
      await prisma.productVariant.deleteMany({ where: { productId: id } })

      const newColors = await prisma.productColor.findMany({ where: { productId: id } })
      const newSizes = await prisma.productSize.findMany({ where: { productId: id } })
      const colorMap = new Map(newColors.map((c: any) => [c.name, c.id]))
      const sizeMap = new Map(newSizes.map((s: any) => [s.name, s.id]))

      const variantData = variants
        .map((v: { colorName: string; sizeName: string; price: number; stock?: number }) => {
          const colorId = colorMap.get(v.colorName)
          const sizeId = sizeMap.get(v.sizeName)
          if (!colorId || !sizeId) return null
          return { productId: id, colorId, sizeId, price: v.price, stock: v.stock ?? 0 }
        })
        .filter(Boolean)

      if (variantData.length > 0) {
        await prisma.productVariant.createMany({ data: variantData as { productId: string; colorId: string; sizeId: string; price: number; stock: number }[] })
      }
    }

    const updated = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        colors: { orderBy: { sortOrder: "asc" } },
        sizes: { orderBy: { sortOrder: "asc" } },
        variants: { include: { color: true, size: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Product update error:", error)
    return NextResponse.json(
      { error: "상품 수정 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  await prisma.product.delete({ where: { id } })
  return NextResponse.json({ message: "삭제되었습니다." })
}
