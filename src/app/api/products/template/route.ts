import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getApiTranslations } from "@/lib/api-i18n"
import * as XLSX from "xlsx"

const COL_WIDTHS = [
  { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 30 },
  { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
  { wch: 32 }, { wch: 8 },
]

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const t = await getApiTranslations(request, "admin")

  const HEADERS = [
    t("templateProductCode"),
    t("templateProductName"),
    t("templateCategory"),
    t("templateDescription"),
    t("templateComposition"),
    t("templateColorName"),
    t("templateColorCode"),
    t("templatePrice"),
    t("templateSize"),
    t("templateStock"),
  ]

  const type = request.nextUrl.searchParams.get("type")
  const isKids = type === "kids"

  // Example data stays in Korean (sample product names/categories are DB data)
  const exampleRows = isKids
    ? [
        ["KD001", "아동 반팔티", "아동상의", "부드러운 아동용 반팔티", "면 100%", "블랙", "#000000", 12000, "80,85,90,95,100,110,120,130", 30],
        ["KD001", "아동 반팔티", "아동상의", "", "", "화이트", "#FFFFFF", 12000, "80,85,90,95,100,110,120,130", 20],
        ["KD002", "아동 후드티", "아동상의", "", "면 80% 폴리 20%", "네이비", "#001f5b", 18000, "90,100,110,120", 50],
      ]
    : [
        ["ST001", "기본 반팔티", "상의", "편안한 면 소재 반팔티셔츠", "면 100%", "블랙", "#000000", 15000, "XS,S,M,L,XL", 0],
        ["ST001", "기본 반팔티", "상의", "", "", "화이트", "#FFFFFF", 15000, "XS,S,M,L,XL", 0],
        ["ST002", "데님 팬츠", "하의", "스트레치 데님 팬츠", "면 98% 폴리 2%", "인디고", "#3B5998", 35000, "S,M,L,XL,2XL", 10],
        ["ST003", "FREE 원피스", "원피스", "", "폴리 100%", "블랙", "#000000", 28000, "FREE", 100],
      ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...exampleRows])
  ws["!cols"] = COL_WIDTHS
  const sheetName = isKids ? t("templateSheetKids") : t("templateSheetAdult")
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  const fileName = isKids
    ? `${t("kidsTemplate")}.xlsx`
    : `${t("adultTemplate")}.xlsx`
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}
