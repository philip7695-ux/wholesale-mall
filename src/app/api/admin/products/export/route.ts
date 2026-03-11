import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
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
