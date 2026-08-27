import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"
import { apiRoute } from "@/lib/api-route"
import { ALL_SIZE_NAMES, sortSizeNames } from "@/lib/product-sizes"

// 내보내기·템플릿에서 쓰는 상품 페이로드(관계 포함) 타입
type ExportProduct = Prisma.ProductGetPayload<{
  include: {
    category: true
    colors: true
    sizes: true
    variants: { include: { color: true; size: true } }
  }
}>

async function GET_impl(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const products = await prisma.product.findMany({
    include: {
      category: true,
      colors: { orderBy: { sortOrder: "asc" } },
      sizes: { orderBy: { sortOrder: "asc" } },
      variants: { include: { color: true, size: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  // 템플릿과 같은 형식으로 내보내 그대로 고쳐 다시 올릴 수 있게 한다.
  const format = new URL(request.url).searchParams.get("format")
  if (format === "template") {
    return buildTemplateWorkbook(products)
  }

  // 시트1: 상품 요약
  const summaryRows = products.map((p) => ({
    "상품코드": p.code || "",
    "상품명": p.name,
    "카테고리": p.category.name,
    "구분": p.ageGroup || "-",
    "통화": p.priceCurrency,
    "색상수": p.colors.length,
    "사이즈": p.sizes.map((s) => s.name).join(", "),
    "SKU수": p.variants.length,
    "최저가": p.variants.length > 0
      ? Math.min(...p.variants.map((v) => v.price))
      : 0,
    "최고가": p.variants.length > 0
      ? Math.max(...p.variants.map((v) => v.price))
      : 0,
    "총재고": p.variants.reduce((sum, v) => sum + v.stock, 0),
    "소재": p.material || "",
    "MOQ": p.moq,
    "색상MOQ": p.colorMoq,
    "상태": p.isActive ? "활성" : "비활성",
    "등록일": p.createdAt.toISOString().split("T")[0],
  }))

  // 시트2: SKU 상세 (컬러/사이즈별 가격, 재고)
  const detailRows: Record<string, string | number>[] = []
  for (const p of products) {
    for (const v of p.variants) {
      detailRows.push({
        "상품코드": p.code || "",
        "상품명": p.name,
        "카테고리": p.category.name,
        "통화": p.priceCurrency,
        "컬러명": v.color.name,
        "사이즈": v.size.name,
        "가격": v.price,
        "재고": v.stock,
      })
    }
  }

  const wb = XLSX.utils.book_new()

  const ws1 = XLSX.utils.json_to_sheet(summaryRows)
  ws1["!cols"] = [
    { wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 8 }, { wch: 6 },
    { wch: 6 }, { wch: 25 }, { wch: 6 }, { wch: 10 }, { wch: 10 },
    { wch: 8 }, { wch: 20 }, { wch: 6 }, { wch: 8 }, { wch: 6 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, ws1, "상품요약")

  const ws2 = XLSX.utils.json_to_sheet(detailRows)
  ws2["!cols"] = [
    { wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 6 },
    { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 8 },
  ]
  XLSX.utils.book_append_sheet(wb, ws2, "SKU상세")

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="products_${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  })
}

export const GET = apiRoute(GET_impl, { retry: true })

const BASE_HEADERS = ["상품코드", "상품명*", "카테고리*", "연령대", "혼용률", "원산지", "컬러명*", "컬러코드", "통화", "가격*"]

// 사이즈 열을 한 시트에 다 펼친다. 이름이 서로 겹치지 않으므로 성인/아동을
// 나눌 필요가 없다. 업로더도 헤더에서 사이즈 열을 알아서 찾는다.
const SIZE_COLUMNS = sortSizeNames(ALL_SIZE_NAMES)

/** 업로드 템플릿과 같은 형식(시트 하나)으로 현재 상품을 내보낸다. */
function buildTemplateWorkbook(products: ExportProduct[]): NextResponse {
  const headers = [...BASE_HEADERS, ...SIZE_COLUMNS]
  const rows: (string | number)[][] = []

  for (const p of products) {
    for (const c of p.colors) {
      const colorVariants = p.variants.filter((v) => v.color.name === c.name)
      // 색상 단가는 그 색상 첫 변형 가격을 쓴다(템플릿은 색상당 한 가격)
      const price = colorVariants[0]?.price ?? 0
      const stockOf = (sizeName: string): string | number => {
        const v = colorVariants.find((x) => x.size.name === sizeName)
        return v ? v.stock : ""
      }
      rows.push([
        p.code || "", p.name, p.category.name, p.ageGroup || "",
        p.material || "", p.origin || "", c.name, c.colorCode || "",
        p.priceCurrency, price,
        ...SIZE_COLUMNS.map((sz) => stockOf(sz)),
      ])
    }
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws["!cols"] = headers.map((h, i) =>
    i < BASE_HEADERS.length ? { wch: [12, 22, 12, 10, 24, 12, 12, 10, 8, 10][i] } : { wch: 6 },
  )
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "상품목록")

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  const fileName = `상품정보_${new Date().toISOString().split("T")[0]}.xlsx`
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}
