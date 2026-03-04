import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import * as XLSX from "xlsx"

const SIZE_COLUMNS = ["F", "S", "M", "L", "80", "85", "90", "100", "110", "120", "130"]

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const headers = ["상품코드", "상품명*", "카테고리*", "설명", "혼용률", "컬러명*", "컬러코드", "가격*", ...SIZE_COLUMNS]

  const exampleRows = [
    ["ST001", "기본 반팔티", "상의", "편안한 면 소재 반팔티셔츠", "면 100%", "블랙", "#000000", 15000, 100, 120, 80, 50, "", "", "", "", "", "", ""],
    ["ST001", "기본 반팔티", "상의", "", "", "화이트", "#FFFFFF", 15000, 80, 90, 60, 40, "", "", "", "", "", "", ""],
    ["KD001", "아동 반팔티", "아동상의", "부드러운 아동용 반팔티", "면 100%", "블랙", "#000000", 12000, "", "", "", "", 50, 60, 80, 90, 70, 50, 30],
    ["KD001", "아동 반팔티", "아동상의", "", "", "화이트", "#FFFFFF", 12000, "", "", "", "", 40, 50, 70, 80, 60, 40, ""],
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleRows])

  ws["!cols"] = [
    { wch: 12 }, // 상품코드
    { wch: 20 }, // 상품명
    { wch: 12 }, // 카테고리
    { wch: 30 }, // 설명
    { wch: 25 }, // 혼용률
    { wch: 12 }, // 컬러명
    { wch: 10 }, // 컬러코드
    { wch: 10 }, // 가격
    ...SIZE_COLUMNS.map(() => ({ wch: 6 })),
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "상품등록")

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent("상품_대량등록_템플릿.xlsx")}`,
    },
  })
}
