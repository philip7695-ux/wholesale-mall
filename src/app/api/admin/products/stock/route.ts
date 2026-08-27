import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"
import { ALL_SIZES } from "@/lib/product-sizes"
import { apiRoute } from "@/lib/api-route"

// GET: 재고 현황 엑셀 다운로드
async function GET_impl(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      colors: { orderBy: { sortOrder: "asc" } },
      sizes: { orderBy: { sortOrder: "asc" } },
      variants: {
        include: { color: true, size: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // 전체에서 사용되는 사이즈 수집 (정렬)
  const allUsedSizes = new Set<string>()
  for (const p of products) {
    for (const s of p.sizes) {
      allUsedSizes.add(s.name)
    }
  }
  const sizeColumns = [...allUsedSizes].sort((a, b) => {
    const ai = ALL_SIZES.indexOf(a)
    const bi = ALL_SIZES.indexOf(b)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  // 세로형: 행마다 사이즈 하나(사이즈·재고 열). 대량등록 세로형과 같은 감각.
  const vertical = request.nextUrl.searchParams.get("layout") === "rows"
  if (vertical) {
    const vHeaders = ["상품코드", "상품명", "컬러명", "가격", "사이즈", "재고"]
    const vRows: (string | number)[][] = []
    for (const product of products) {
      for (const color of product.colors) {
        const colorVariants = product.variants
          .filter((v) => v.colorId === color.id)
          .sort((a, b) => {
            const ai = ALL_SIZES.indexOf(a.size.name); const bi = ALL_SIZES.indexOf(b.size.name)
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
          })
        for (const v of colorVariants) {
          vRows.push([product.code || "", product.name, color.name, v.price, v.size.name, v.stock])
        }
      }
    }
    const wbV = XLSX.utils.book_new()
    const wsV = XLSX.utils.aoa_to_sheet([vHeaders, ...vRows])
    wsV["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 8 }]
    XLSX.utils.book_append_sheet(wbV, wsV, "재고현황")
    const bufV = XLSX.write(wbV, { type: "buffer", bookType: "xlsx" })
    const fileNameV = `재고현황_세로형_${new Date().toISOString().split("T")[0]}.xlsx`
    return new NextResponse(bufV, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileNameV)}`,
      },
    })
  }

  const baseHeaders = ["상품코드", "상품명", "컬러명", "가격"]
  const headers = [...baseHeaders, ...sizeColumns]

  const rows: (string | number)[][] = []
  for (const product of products) {
    for (const color of product.colors) {
      const row: (string | number)[] = [
        product.code || "",
        product.name,
        color.name,
        // 해당 컬러의 첫 번째 variant 가격
        product.variants.find((v) => v.colorId === color.id)?.price ?? 0,
      ]
      // 사이즈별 재고
      for (const sizeName of sizeColumns) {
        const variant = product.variants.find(
          (v) => v.colorId === color.id && v.size.name === sizeName
        )
        row.push(variant ? variant.stock : "")
      }
      rows.push(row)
    }
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws["!cols"] = [
    { wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 10 },
    ...sizeColumns.map(() => ({ wch: 8 })),
  ]
  XLSX.utils.book_append_sheet(wb, ws, "재고현황")

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  const fileName = `재고현황_${new Date().toISOString().split("T")[0]}.xlsx`

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}

// POST: 재고 업데이트 엑셀 업로드
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: "buffer" })

    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) return NextResponse.json({ error: "시트가 없습니다." }, { status: 400 })

    const rows = XLSX.utils.sheet_to_json(ws) as Record<string, any>[]
    if (rows.length === 0) return NextResponse.json({ error: "데이터가 없습니다." }, { status: 400 })

    // 세로형(사이즈·재고 열)이면 가로형 한 줄(컬러당)로 합쳐 기존 로직을 태운다.
    let workRows: Record<string, any>[] = rows
    if ("사이즈" in rows[0] && "재고" in rows[0]) {
      const byKey = new Map<string, Record<string, any>>()
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const code = String(r["상품코드"] ?? "").trim()
        const name = String(r["상품명"] ?? "").trim()
        const colorName = String(r["컬러명"] ?? "").trim()
        const size = String(r["사이즈"] ?? "").trim()
        const key = `${code}|${name}|${colorName}`
        if (!byKey.has(key)) {
          byKey.set(key, { 상품코드: code, 상품명: name, 컬러명: colorName, __row: i + 2 })
        }
        if (size !== "") byKey.get(key)![size] = r["재고"]
      }
      workRows = [...byKey.values()]
    }

    // 헤더에서 사이즈 컬럼 추출 (기본 컬럼 제외한 나머지가 사이즈)
    const baseKeys = new Set(["상품코드", "상품명", "컬러명", "가격", "사이즈", "재고", "__row"])
    const sizeColumns = [...new Set(workRows.flatMap((r) => Object.keys(r)))].filter((k) => !baseKeys.has(k))

    let updated = 0
    const failed: { row: number; error: string }[] = []

    for (let i = 0; i < workRows.length; i++) {
      const row = workRows[i]
      const rowNum = Number(row.__row) || i + 2
      const code = String(row["상품코드"] ?? "").trim()
      const name = String(row["상품명"] ?? "").trim()
      const colorName = String(row["컬러명"] ?? "").trim()

      if (!name && !code) {
        failed.push({ row: rowNum, error: "상품코드 또는 상품명이 필요합니다." })
        continue
      }
      if (!colorName) {
        failed.push({ row: rowNum, error: "컬러명이 비어있습니다." })
        continue
      }

      // 상품 찾기: 상품코드 우선, 없으면 상품명
      const product = code
        ? await prisma.product.findFirst({
            where: { code },
            include: {
              colors: true,
              sizes: true,
              variants: { include: { color: true, size: true } },
            },
          })
        : await prisma.product.findFirst({
            where: { name },
            include: {
              colors: true,
              sizes: true,
              variants: { include: { color: true, size: true } },
            },
          })

      if (!product) {
        failed.push({ row: rowNum, error: `상품을 찾을 수 없습니다: ${code || name}` })
        continue
      }

      const color = product.colors.find((c) => c.name === colorName)
      if (!color) {
        failed.push({ row: rowNum, error: `컬러를 찾을 수 없습니다: ${colorName} (상품: ${product.name})` })
        continue
      }

      // 사이즈별 재고 업데이트
      // 빈 셀 = 변경 없음, 숫자 > 0 = 재고 설정 (없으면 생성), 0 = variant 삭제
      for (const sizeName of sizeColumns) {
        const val = row[sizeName]
        if (val === undefined || val === null || val === "") continue

        const stock = Number(val)
        if (isNaN(stock)) continue

        const variant = product.variants.find(
          (v) => v.colorId === color.id && v.size.name === sizeName
        )

        if (stock <= 0) {
          // 0 입력 → variant 삭제 (해당 사이즈 제거)
          if (variant) {
            await prisma.productVariant.delete({ where: { id: variant.id } })
            // 해당 사이즈에 다른 variant가 없으면 ProductSize도 삭제
            const remainingVariants = await prisma.productVariant.count({
              where: { productId: product.id, sizeId: variant.sizeId },
            })
            if (remainingVariants === 0) {
              await prisma.productSize.delete({ where: { id: variant.sizeId } })
            }
            updated++
          }
        } else if (variant) {
          // 기존 variant 재고 업데이트
          await prisma.productVariant.update({
            where: { id: variant.id },
            data: { stock },
          })
          updated++
        } else {
          // variant가 없으면 사이즈 확인/생성 후 variant 생성
          let size = product.sizes.find((s) => s.name === sizeName)
          if (!size) {
            size = await prisma.productSize.create({
              data: {
                productId: product.id,
                name: sizeName,
                sortOrder: ALL_SIZES.indexOf(sizeName) >= 0 ? ALL_SIZES.indexOf(sizeName) : 999,
              },
            })
          }
          const price = product.variants.find((v) => v.colorId === color.id)?.price ?? 0
          await prisma.productVariant.create({
            data: {
              productId: product.id,
              colorId: color.id,
              sizeId: size.id,
              price,
              stock,
            },
          })
          updated++
        }
      }
    }

    return NextResponse.json({ updated, failed })
  } catch (error) {
    console.error("Stock update error:", error)
    return NextResponse.json({ error: "재고 업데이트 처리 중 오류가 발생했습니다." }, { status: 500 })
  }
}

export const GET = apiRoute(GET_impl, { retry: true })
