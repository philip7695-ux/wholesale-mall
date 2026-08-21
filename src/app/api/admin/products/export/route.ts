import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"
import { apiRoute } from "@/lib/api-route"
import { ADULT_SIZES, KIDS_NUM_SIZES, KIDS_LETTER_SIZES } from "@/lib/product-sizes"

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
  const summaryRows = products.map((p: any) => ({
    "상품코드": p.code || "",
    "상품명": p.name,
    "카테고리": p.category.name,
    "구분": p.ageGroup || "-",
    "통화": p.priceCurrency,
    "색상수": p.colors.length,
    "사이즈": p.sizes.map((s: any) => s.name).join(", "),
    "SKU수": p.variants.length,
    "최저가": p.variants.length > 0
      ? Math.min(...p.variants.map((v: any) => v.price))
      : 0,
    "최고가": p.variants.length > 0
      ? Math.max(...p.variants.map((v: any) => v.price))
      : 0,
    "총재고": p.variants.reduce((sum: number, v: any) => sum + v.stock, 0),
    "소재": p.material || "",
    "MOQ": p.moq,
    "색상MOQ": p.colorMoq,
    "상태": p.isActive ? "활성" : "비활성",
    "등록일": p.createdAt.toISOString().split("T")[0],
  }))

  // 시트2: SKU 상세 (컬러/사이즈별 가격, 재고)
  const detailRows: Record<string, any>[] = []
  for (const p of products) {
    for (const v of (p as any).variants) {
      detailRows.push({
        "상품코드": (p as any).code || "",
        "상품명": p.name,
        "카테고리": (p as any).category.name,
        "통화": (p as any).priceCurrency,
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

const BASE_HEADERS = ["상품코드", "상품명*", "카테고리*", "연령대", "설명", "혼용률", "원산지", "컬러명*", "컬러코드", "컬러값(HEX)", "통화", "가격*"]

/** 상품의 사이즈가 어느 사이즈 집합에 속하는지 보고 시트를 고른다. */
function classifySizeSheet(sizeNames: string[]): "adult" | "num" | "letter" {
  const inSet = (set: readonly string[]) => sizeNames.every((n) => set.includes(n))
  if (inSet(ADULT_SIZES)) return "adult"
  if (inSet(KIDS_NUM_SIZES)) return "num"
  if (inSet(KIDS_LETTER_SIZES)) return "letter"
  // 섞여 있으면 더 많이 덮는 집합으로 보낸다(드문 경우)
  const cover = (set: readonly string[]) => sizeNames.filter((n) => set.includes(n)).length
  const num = cover(KIDS_NUM_SIZES), letter = cover(KIDS_LETTER_SIZES), adult = cover(ADULT_SIZES)
  if (num >= letter && num >= adult) return "num"
  if (letter >= adult) return "letter"
  return "adult"
}

/** 업로드 템플릿과 같은 3시트 형식으로 현재 상품을 내보낸다. */
function buildTemplateWorkbook(products: any[]): NextResponse {
  const sheets: Record<"adult" | "num" | "letter", { cols: readonly string[]; name: string; rows: any[][] }> = {
    adult: { cols: ADULT_SIZES, name: "성인복", rows: [] },
    num: { cols: KIDS_NUM_SIZES, name: "아동복(숫자사이즈)", rows: [] },
    letter: { cols: KIDS_LETTER_SIZES, name: "아동복(영어사이즈)", rows: [] },
  }

  for (const p of products) {
    const sizeNames = p.sizes.map((s: any) => s.name)
    const bucket = sheets[classifySizeSheet(sizeNames)]
    for (const c of p.colors) {
      const colorVariants = p.variants.filter((v: any) => v.color.name === c.name)
      // 색상 단가는 그 색상 첫 변형 가격을 쓴다(템플릿은 색상당 한 가격)
      const price = colorVariants[0]?.price ?? 0
      const stockOf = (sizeName: string) => {
        const v = colorVariants.find((x: any) => x.size.name === sizeName)
        return v ? v.stock : ""
      }
      bucket.rows.push([
        p.code || "", p.name, p.category.name, p.ageGroup || "", p.description || "",
        p.material || "", p.origin || "", c.name, c.colorCode || "", c.hexColor || "",
        p.priceCurrency, price,
        ...bucket.cols.map((sz) => stockOf(sz)),
      ])
    }
  }

  const wb = XLSX.utils.book_new()
  for (const key of ["adult", "num", "letter"] as const) {
    const sh = sheets[key]
    if (sh.rows.length === 0) continue
    const headers = [...BASE_HEADERS, ...sh.cols]
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sh.rows])
    ws["!cols"] = headers.map((h, i) => ({ wch: i < BASE_HEADERS.length ? [12,22,12,10,28,24,12,12,10,10,8,10][i] : 7 }))
    XLSX.utils.book_append_sheet(wb, ws, sh.name)
  }
  // 상품이 하나도 없더라도 빈 성인복 시트라도 준다
  if (wb.SheetNames.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([[...BASE_HEADERS, ...ADULT_SIZES]])
    XLSX.utils.book_append_sheet(wb, ws, "성인복")
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  const fileName = `상품정보_${new Date().toISOString().split("T")[0]}.xlsx`
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}
