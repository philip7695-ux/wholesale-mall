import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import * as XLSX from "xlsx"
import { ADULT_SIZES, KIDS_NUM_SIZES, KIDS_LETTER_SIZES } from "@/lib/product-sizes"

const BASE_HEADERS = ["상품코드", "상품명*", "카테고리*", "설명", "혼용률", "컬러명*", "컬러코드", "컬러값(HEX)", "가격*"]
const BASE_COL_WIDTHS = [
  { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 30 },
  { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
]

function buildSheet(headers: string[], rows: any[][], sizeColumns: string[]) {
  const fullHeaders = [...headers, ...sizeColumns]
  const ws = XLSX.utils.aoa_to_sheet([fullHeaders, ...rows])
  ws["!cols"] = [
    ...BASE_COL_WIDTHS,
    ...sizeColumns.map(() => ({ wch: 8 })),
  ]
  return ws
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const type = request.nextUrl.searchParams.get("type")
  const isKids = type === "kids"

  const wb = XLSX.utils.book_new()

  if (isKids) {
    // 시트1: 숫자 사이즈 (80, 85, 90, ...)
    // 빈 셀 = 해당 사이즈 없음, 숫자 = 재고 수량
    const numRows = [
      ["KD001", "유아 반팔티", "유아상의", "부드러운 유아용 반팔티", "면 100%", "블랙", "BK", "#000000", 12000, 30, 30, 25, 25, 20, "", "", "", ""],
      ["KD001", "유아 반팔티", "유아상의", "", "", "화이트", "WH", "#FFFFFF", 12000, 20, 20, 15, 15, 10, "", "", "", ""],
      ["KD002", "아동 후드티", "아동상의", "", "면 80% 폴리 20%", "네이비", "NV", "#001f5b", 18000, "", "", "", "", 50, 40, 30, 20, 10],
    ]
    const ws1 = buildSheet(BASE_HEADERS, numRows, KIDS_NUM_SIZES)
    XLSX.utils.book_append_sheet(wb, ws1, "아동복(숫자사이즈)")

    // 시트2: 영어 사이즈 (F, S, M, L)
    const letterRows = [
      ["KD003", "아동 원피스", "아동원피스", "귀여운 원피스", "폴리 100%", "핑크", "PK", "#FF69B4", 15000, 100, 0, 0, 0],
      ["KD004", "아동 티셔츠", "아동상의", "", "면 100%", "블랙", "BK", "#000000", 10000, 0, 30, 25, 20],
    ]
    const ws2 = buildSheet(BASE_HEADERS, letterRows, KIDS_LETTER_SIZES)
    XLSX.utils.book_append_sheet(wb, ws2, "아동복(영어사이즈)")
  } else {
    // 성인복
    // 빈 셀 = 해당 사이즈 없음, 숫자 = 재고 수량
    const adultRows = [
      ["ST001", "기본 반팔티", "상의", "편안한 면 소재 반팔티셔츠", "면 100%", "블랙", "01", "#000000", 15000, 10, 20, 30, 30, 20, 10, 5, ""],
      ["ST001", "기본 반팔티", "상의", "", "", "화이트", "02", "#FFFFFF", 15000, 10, 15, 25, 25, 15, 5, "", ""],
      ["ST002", "데님 팬츠", "하의", "스트레치 데님 팬츠", "면 98% 폴리 2%", "인디고", "ID", "#3B5998", 35000, "", 10, 15, 15, 10, 5, "", ""],
      ["ST003", "FREE 원피스", "원피스", "", "폴리 100%", "블랙", "BK", "#000000", 28000, "", "", "", "", "", "", "", 100],
    ]
    const ws = buildSheet(BASE_HEADERS, adultRows, ADULT_SIZES)
    XLSX.utils.book_append_sheet(wb, ws, "성인복")
  }

  const fileName = isKids ? "아동복_대량등록_템플릿.xlsx" : "성인복_대량등록_템플릿.xlsx"
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}
