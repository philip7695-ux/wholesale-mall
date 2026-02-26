import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const category = searchParams.get("category")
  const search = searchParams.get("search")
  const page = parseInt(searchParams.get("page") || "1")
  const limit = parseInt(searchParams.get("limit") || "20")

  const where: Record<string, unknown> = { isActive: true }
  if (category) where.category = { slug: category }
  if (search) where.name = { contains: search, mode: "insensitive" }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: true,
        colors: { orderBy: { sortOrder: "asc" } },
        sizes: { orderBy: { sortOrder: "asc" } },
        variants: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ])

  return NextResponse.json({ products, total, page, totalPages: Math.ceil(total / limit) })
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, code, description, categoryId, thumbnail, images, material, sizeSpec, isActive, colors, sizes, variants } = body

    const product = await prisma.product.create({
      data: {
        name,
        code: code || null,
        description,
        categoryId,
        thumbnail,
        images: images || [],
        material: material || null,
        sizeSpec: sizeSpec || null,
        isActive: isActive ?? true,
        colors: {
          create: (colors || []).map((c: { name: string; colorCode?: string; images?: string[]; sortOrder?: number }, i: number) => ({
            name: c.name,
            colorCode: c.colorCode,
            images: c.images || [],
            sortOrder: c.sortOrder ?? i,
          })),
        },
        sizes: {
          create: (sizes || []).map((s: { name: string; sortOrder?: number }, i: number) => ({
            name: s.name,
            sortOrder: s.sortOrder ?? i,
          })),
        },
      },
      include: { colors: true, sizes: true },
    })

    // Create variants (color x size matrix)
    if (variants && variants.length > 0) {
      const colorMap = new Map(product.colors.map((c: any) => [c.name, c.id]))
      const sizeMap = new Map(product.sizes.map((s: any) => [s.name, s.id]))

      const variantData = variants
        .map((v: { colorName: string; sizeName: string; price: number; stock?: number }) => {
          const colorId = colorMap.get(v.colorName)
          const sizeId = sizeMap.get(v.sizeName)
          if (!colorId || !sizeId) return null
          return {
            productId: product.id,
            colorId,
            sizeId,
            price: v.price,
            stock: v.stock ?? 0,
          }
        })
        .filter(Boolean)

      if (variantData.length > 0) {
        await prisma.productVariant.createMany({ data: variantData as { productId: string; colorId: string; sizeId: string; price: number; stock: number }[] })
      }
    }

    const fullProduct = await prisma.product.findUnique({
      where: { id: product.id },
      include: {
        category: true,
        colors: { orderBy: { sortOrder: "asc" } },
        sizes: { orderBy: { sortOrder: "asc" } },
        variants: { include: { color: true, size: true } },
      },
    })

    return NextResponse.json(fullProduct, { status: 201 })
  } catch (error) {
    console.error("Product creation error:", error)
    return NextResponse.json(
      { error: "상품 등록 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
