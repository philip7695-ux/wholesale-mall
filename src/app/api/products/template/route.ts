import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import * as XLSX from "xlsx"
import { ADULT_SIZES, KIDS_NUM_SIZES, KIDS_LETTER_SIZES } from "@/lib/product-sizes"

/**
 * 대량등록 빈 템플릿.
 *
 * 두 가지 배치를 지원한다(다운로드 시 선택).
 *  - 가로형(기본): 사이즈가 열로 펼쳐지고 셀에 재고 수량을 적는다.
 *  - 세로형(layout=rows): 사이즈* / 재고 두 열에 행마다 한 사이즈씩 적는다.
 * 업로드 파서는 헤더를 보고 두 형식을 모두 인식한다.
 */
const BASE_HEADERS = ["상품코드", "상품명*", "카테고리*", "연령대", "브랜드", "연도", "시즌", "혼용률", "원산지", "컬러명*", "컬러코드", "통화", "가격*"]
const BASE_COL_WIDTHS = [
  { wch: 12 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 8 },
  { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
]

function buildGridSheet(rows: (string | number)[][], sizeColumns: readonly string[]) {
  const fullHeaders = [...BASE_HEADERS, ...sizeColumns]
  const ws = XLSX.utils.aoa_to_sheet([fullHeaders, ...rows])
  ws["!cols"] = [...BASE_COL_WIDTHS, ...sizeColumns.map(() => ({ wch: 8 }))]
  return ws
}

function buildRowsSheet(rows: (string | number)[][]) {
  const fullHeaders = [...BASE_HEADERS, "사이즈*", "재고"]
  const ws = XLSX.utils.aoa_to_sheet([fullHeaders, ...rows])
  ws["!cols"] = [...BASE_COL_WIDTHS, { wch: 10 }, { wch: 8 }]
  return ws
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const type = request.nextUrl.searchParams.get("type")
  const layout = request.nextUrl.searchParams.get("layout") // "rows" = 세로형
  const isKids = type === "kids"
  const vertical = layout === "rows"

  const wb = XLSX.utils.book_new()

  if (vertical) {
    // 세로형: 행마다 사이즈 하나씩. 예시는 가로형과 같은 상품이다.
    const rows: (string | number)[][] = isKids
      ? [
          ["KD001", "유아 반팔티", "유아상의", "BABY", "BEBEDEPINO", 2027, "SS", "면 100%", "대한민국", "블랙", "BK", "KRW", 12000, "80", 30],
          ["KD001", "유아 반팔티", "유아상의", "BABY", "", "", "", "", "", "블랙", "BK", "KRW", 12000, "85", 30],
          ["KD001", "유아 반팔티", "유아상의", "BABY", "", "", "", "", "", "블랙", "BK", "KRW", 12000, "90", 25],
          ["KD001", "유아 반팔티", "유아상의", "BABY", "", "", "", "", "", "화이트", "WH", "KRW", 12000, "80", 20],
          ["KD001", "유아 반팔티", "유아상의", "BABY", "", "", "", "", "", "화이트", "WH", "KRW", 12000, "85", 20],
          ["KD003", "아동 원피스", "아동원피스", "KIDS", "BEBEDEPINO", 2027, "SS", "폴리 100%", "중국", "핑크", "PK", "CNY", 75, "F", 100],
        ]
      : [
          ["ST001", "기본 반팔티", "상의", "", "BEBEDEPINO", 2027, "SS", "면 100%", "대한민국", "블랙", "01", "USD", 11.5, "S", 20],
          ["ST001", "기본 반팔티", "상의", "", "", "", "", "", "", "블랙", "01", "USD", 11.5, "M", 30],
          ["ST001", "기본 반팔티", "상의", "", "", "", "", "", "", "블랙", "01", "USD", 11.5, "L", 30],
          ["ST002", "데님 팬츠", "하의", "", "BEBEDEPINO", 2027, "SS", "면 98% 폴리 2%", "중국", "인디고", "ID", "KRW", 35000, "M", 15],
          ["ST003", "FREE 원피스", "원피스", "", "BEBEDEPINO", 2027, "SS", "폴리 100%", "", "블랙", "BK", "CNY", 150, "F", 100],
        ]
    const ws = buildRowsSheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, isKids ? "아동복(세로형)" : "성인복(세로형)")
  } else if (isKids) {
    // 시트1: 숫자 사이즈 (80, 85, 90, ...) — 빈 셀 = 사이즈 없음, 숫자 = 재고
    const numRows: (string | number)[][] = [
      ["KD001", "유아 반팔티", "유아상의", "BABY", "BEBEDEPINO", 2027, "SS", "면 100%", "대한민국", "블랙", "BK", "KRW", 12000, 30, 30, 25, 25, 20, "", "", "", ""],
      ["KD001", "유아 반팔티", "유아상의", "BABY", "", "", "", "", "", "화이트", "WH", "KRW", 12000, 20, 20, 15, 15, 10, "", "", "", ""],
      ["KD002", "아동 후드티", "아동상의", "KIDS", "BEBEDEPINO", 2027, "SS", "면 80% 폴리 20%", "베트남", "네이비", "NV", "USD", 10, "", "", "", "", 50, 40, 30, 20, 10],
    ]
    XLSX.utils.book_append_sheet(wb, buildGridSheet(numRows, KIDS_NUM_SIZES), "아동복(숫자사이즈)")

    // 시트2: 영어 사이즈 (F, S, M, L)
    const letterRows: (string | number)[][] = [
      ["KD003", "아동 원피스", "아동원피스", "KIDS", "BEBEDEPINO", 2027, "SS", "폴리 100%", "중국", "핑크", "PK", "CNY", 75, 100, 0, 0, 0],
      ["KD004", "아동 티셔츠", "아동상의", "KIDS", "BEBEDEPINO", 2027, "SS", "면 100%", "", "블랙", "BK", "KRW", 10000, 0, 30, 25, 20],
    ]
    XLSX.utils.book_append_sheet(wb, buildGridSheet(letterRows, KIDS_LETTER_SIZES), "아동복(영어사이즈)")
  } else {
    // 성인복 — 빈 셀 = 사이즈 없음, 숫자 = 재고
    const adultRows: (string | number)[][] = [
      ["ST001", "기본 반팔티", "상의", "", "BEBEDEPINO", 2027, "SS", "면 100%", "대한민국", "블랙", "01", "USD", 11.5, 10, 20, 30, 30, 20, 10, 5, ""],
      ["ST001", "기본 반팔티", "상의", "", "", "", "", "", "", "화이트", "02", "USD", 11.5, 10, 15, 25, 25, 15, 5, "", ""],
      ["ST002", "데님 팬츠", "하의", "", "BEBEDEPINO", 2027, "SS", "면 98% 폴리 2%", "중국", "인디고", "ID", "KRW", 35000, "", 10, 15, 15, 10, 5, "", ""],
      ["ST003", "FREE 원피스", "원피스", "", "BEBEDEPINO", 2027, "SS", "폴리 100%", "", "블랙", "BK", "CNY", 150, "", "", "", "", "", "", "", 100],
    ]
    XLSX.utils.book_append_sheet(wb, buildGridSheet(adultRows, ADULT_SIZES), "성인복")
  }

  const base = isKids ? "아동복_대량등록_템플릿" : "성인복_대량등록_템플릿"
  const fileName = `${base}${vertical ? "_세로형" : ""}.xlsx`
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}
