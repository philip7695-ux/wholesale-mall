import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

interface ExcelRow {
  "상품코드"?: string
  "상품명*": string
  "카테고리*": string
  "설명"?: string
  "혼용률"?: string
  "컬러명*": string
  "컬러코드"?: string
  "사이즈*": string
  "가격*": number
  "재고"?: number
}

interface FailedRow {
  row: number
  error: string
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: "buffer" })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<ExcelRow>(ws)

    if (rows.length === 0) {
      return NextResponse.json({ error: "엑셀에 데이터가 없습니다." }, { status: 400 })
    }

    // Validate rows and group by product name
    const failed: FailedRow[] = []
    const productGroups = new Map<string, { code: string; category: string; description: string; material: string; variants: { colorName: string; colorCode: string; sizeName: string; price: number; stock: number }[] }>()

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2 // Excel row number (header is row 1)

      const code = String(row["상품코드"] ?? "").trim()
      const name = String(row["상품명*"] ?? "").trim()
      const category = String(row["카테고리*"] ?? "").trim()
      const colorName = String(row["컬러명*"] ?? "").trim()
      const sizeName = String(row["사이즈*"] ?? "").trim()
      const priceRaw = row["가격*"]
      const price = Number(priceRaw)

      // Validate required fields
      if (!name) {
        failed.push({ row: rowNum, error: "상품명이 비어있습니다." })
        continue
      }
      if (!category) {
        failed.push({ row: rowNum, error: "카테고리가 비어있습니다." })
        continue
      }
      if (!colorName) {
        failed.push({ row: rowNum, error: "컬러명이 비어있습니다." })
        continue
      }
      if (!sizeName) {
        failed.push({ row: rowNum, error: "사이즈가 비어있습니다." })
        continue
      }
      if (isNaN(price) || price <= 0) {
        failed.push({ row: rowNum, error: "가격이 올바르지 않습니다." })
        continue
      }

      const description = String(row["설명"] ?? "").trim()
      const material = String(row["혼용률"] ?? "").trim()
      const colorCode = String(row["컬러코드"] ?? "").trim()
      const stock = Number(row["재고"] ?? 0)

      if (!productGroups.has(name)) {
        productGroups.set(name, {
          code,
          category,
          description,
          material,
          variants: [],
        })
      }

      const group = productGroups.get(name)!
      // Use description/material from first row that has it
      if (description && !group.description) {
        group.description = description
      }
      if (material && !group.material) {
        group.material = material
      }

      group.variants.push({
        colorName,
        colorCode,
        sizeName,
        price,
        stock: isNaN(stock) ? 0 : stock,
      })
    }

    // Resolve categories (find or create)
    const categoryNames = [...new Set([...productGroups.values()].map((g) => g.category))]
    const categoryMap = new Map<string, string>() // name -> id

    for (const catName of categoryNames) {
      const slug = toSlug(catName)
      let category = await prisma.category.findFirst({
        where: { OR: [{ name: catName }, { slug }] },
      })
      if (!category) {
        category = await prisma.category.create({
          data: { name: catName, slug },
        })
      }
      categoryMap.set(catName, category.id)
    }

    // Create products
    let success = 0

    for (const [productName, group] of productGroups) {
      try {
        const categoryId = categoryMap.get(group.category)
        if (!categoryId) {
          failed.push({ row: 0, error: `카테고리 "${group.category}" 처리 실패` })
          continue
        }

        // Extract unique colors and sizes
        const colorsMap = new Map<string, string>() // colorName -> colorCode
        const sizesSet = new Set<string>()

        for (const v of group.variants) {
          if (!colorsMap.has(v.colorName)) {
            colorsMap.set(v.colorName, v.colorCode)
          }
          sizesSet.add(v.sizeName)
        }

        const colors = [...colorsMap.entries()].map(([name, colorCode], i) => ({
          name,
          colorCode: colorCode || undefined,
          images: [] as string[],
          sortOrder: i,
        }))

        const sizes = [...sizesSet].map((name, i) => ({
          name,
          sortOrder: i,
        }))

        // Create product with colors and sizes
        const product = await prisma.product.create({
          data: {
            name: productName,
            code: group.code || null,
            description: group.description || null,
            material: group.material || null,
            categoryId,
            images: [],
            isActive: true,
            colors: { create: colors },
            sizes: { create: sizes },
          },
          include: { colors: true, sizes: true },
        })

        // Build variant data
        const colorIdMap = new Map(product.colors.map((c: any) => [c.name, c.id]))
        const sizeIdMap = new Map(product.sizes.map((s: any) => [s.name, s.id]))

        const variantData = group.variants
          .map((v) => {
            const colorId = colorIdMap.get(v.colorName)
            const sizeId = sizeIdMap.get(v.sizeName)
            if (!colorId || !sizeId) return null
            return {
              productId: product.id,
              colorId,
              sizeId,
              price: v.price,
              stock: v.stock,
            }
          })
          .filter(Boolean) as { productId: string; colorId: string; sizeId: string; price: number; stock: number }[]

        if (variantData.length > 0) {
          await prisma.productVariant.createMany({ data: variantData })
        }

        success++
      } catch (err: any) {
        failed.push({ row: 0, error: `상품 "${productName}" 생성 실패: ${err.message}` })
      }
    }

    return NextResponse.json({ success, failed })
  } catch (error: any) {
    console.error("Bulk upload error:", error)
    return NextResponse.json(
      { error: "엑셀 업로드 처리 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
