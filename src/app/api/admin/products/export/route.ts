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
      colors: true,
      variants: true,
    },
    orderBy: { createdAt: "desc" },
  })

  const rows = products.map((p: any) => ({
    "상품코드": p.code || "",
    "상품명": p.name,
    "카테고리": p.category.name,
    "색상수": p.colors.length,
    "SKU수": p.variants.length,
    "최저가(CNY)": p.variants.length > 0
      ? Math.min(...p.variants.map((v: any) => v.price))
      : 0,
    "소재": p.material || "",
    "MOQ": p.moq,
    "색상MOQ": p.colorMoq,
    "상태": p.isActive ? "활성" : "비활성",
    "등록일": p.createdAt.toISOString().split("T")[0],
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, "상품목록")

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="products_${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  })
}
