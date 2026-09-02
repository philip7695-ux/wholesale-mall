import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"
import { apiRoute } from "@/lib/api-route"
import { buildAdminProductWhere } from "@/lib/product-filter"
import {
  GS1_CATEGORY_CODES,
  gs1ColorCode,
  gs1SizeCode,
  gs1CountryCode,
  gs1ImportFlag,
} from "@/lib/gs1"

// 코리안넷 업로드 템플릿은 1~5행이 참고란이고 6행부터 상품정보다.
// 실제 템플릿의 안내 행을 그대로 재현해 두면 파일만 봐도 뭘 채웠는지 알 수 있다.
const GUIDE_ROWS: (string | number)[][] = [
  ["순번", "필수정보① (미출시제품 긴급코드 생성의 경우)", "", "", "", "필수정보②", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "선택정보", "", "", "", ""],
  ["", "상품분류", "제조사명", "브랜드명", "상세 상품명", "내용량\n(Net Content) ", " 내용량 단위", "주요판매\n국가", "가로\n(㎝)", "세로\n(㎝)", "높이\n(㎝)", "총중량\n(그램, gram)", "제조국/생산국", "과세형태", "수입여부", "모델명", "KC인증정보", "", "", "사용안함", "색상코드", "사이즈코드", "하위 브랜드명", "영문 상세 상품명", "상품 이미지 URL", "출시일", "단종일"],
  ["1번부터    순차부여\n(1,000건씩\n등록)", "(상품분류코드) 표 참조", "텍스트 입력", "텍스트 입력", "텍스트 입력", "숫자 입력", "(내용량단위코드) 표 참조", "(국가코드) 표 참조", "숫자\n입력", "숫자\n입력", "숫자\n입력", "숫자\n입력", "(국가코드) 표 참조", "과세", "1~3까지 숫자", "모델명이 없을 경우 상품명과 동일하게 입력", "인증번호", "대상아님", "입력보류", "", "(색상코드)\n표 참조", "(사이즈코드)\n표 참조", "텍스트입력", "텍스트 입력", "텍스트 입력", "숫자 8자리 입력", "숫자 8자리 입력"],
  ["", "01010103", "", "", "", "", "086001", "KR", "", "", "", "", "KR", "", "1: 수입제품아님\n2: 수입상품(OEM포함)\n3: 병행수입상품", "", "", "Y", "Y", "", "(의류/패션및전문스포츠/레저상품의 경우만)", "(의류/패션및전문스포츠/레저상품의 경우만)", "", "", "http 또는 https를 포함하여 상품 이미지를 볼 수 있는 URL 입력", "Ex) 20230101", "Ex) 20251231"],
  [],
]

const MANUFACTURER = "주식회사 더캐리"
const UNIT_EA = "086004" // 내용량 단위: EA
const MAX_ROWS = 1000 // 코리안넷 1회 등록 한도(미만)

async function GET_impl(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 어드민 목록과 같은 필터로 대상 상품을 좁힌다
  const sp = new URL(request.url).searchParams
  const where = buildAdminProductWhere({
    year: sp.get("year") || undefined,
    season: sp.get("season") || undefined,
    category: sp.get("category") || undefined,
    brand: sp.get("brand") || undefined,
    code: sp.get("code") || undefined,
  })

  const products = await prisma.product.findMany({
    where,
    include: {
      category: true,
      colors: { orderBy: { sortOrder: "asc" } },
      variants: { include: { color: true, size: true } },
    },
    orderBy: [{ seasonKey: { sort: "desc", nulls: "last" } }, { code: "asc" }],
  })

  const rows: (string | number)[][] = []
  // 변환 못 한 값은 여기 모아 "(검증)" 시트로 낸다. 업로드 전에 사람이 채운다.
  const issues: (string | number)[][] = []
  const issue = (seq: number | "", code: string, field: string, value: string, note: string) =>
    issues.push([seq, code, field, value, note])

  let seq = 0
  for (const p of products) {
    const categoryCode = GS1_CATEGORY_CODES[p.category.slug] ?? ""
    const country = gs1CountryCode(p.origin)
    const productIssues: [string, string, string][] = []
    if (!categoryCode) productIssues.push(["상품분류", p.category.slug, "GS1 분류코드 매핑 없음 — 직접 입력 필요"])
    if (!country) productIssues.push(["제조국", p.origin ?? "(없음)", "원산지 확인 후 국가코드 입력 필요"])
    if (!p.brand) productIssues.push(["브랜드명", "(없음)", "브랜드 입력 필요"])
    if (!p.thumbnail) productIssues.push(["이미지URL", "(없음)", "대표 이미지 없음"])

    for (const v of p.variants) {
      seq++
      const colorName = v.color.name
      const sizeName = v.size.name
      const colorCode = gs1ColorCode(colorName)
      const sizeCode = gs1SizeCode(sizeName, p.ageGroup)
      if (!colorCode) issue(seq, p.code ?? p.name, "색상코드", colorName, "GS1 색상표에 없음 — 코드표에서 골라 입력")
      if (!sizeCode) issue(seq, p.code ?? p.name, "사이즈코드", sizeName, "GS1 사이즈표에 없음 — 코드표에서 골라 입력")
      // 상세상품명: 상품명 + 컬러(이미 이름에 있으면 생략) + 사이즈
      const hasColor = p.name.toLowerCase().includes(colorName.toLowerCase())
      const fullName = [p.name, hasColor ? "" : colorName, sizeName].filter(Boolean).join(" ")
      rows.push([
        seq,
        categoryCode,
        MANUFACTURER,
        p.brand ?? "",
        fullName,
        1,
        UNIT_EA,
        "KR",
        "", "", "", "", // 가로·세로·높이·총중량은 비워 둔다(사용자 결정)
        country ?? "",
        "과세",
        gs1ImportFlag(country),
        p.code ?? "",
        "", "", "", "", // KC인증·대상아님·입력보류·사용안함
        colorCode ?? "",
        sizeCode ?? "",
        "",
        fullName,
        p.thumbnail ?? "",
        "", "",
      ])
    }
    for (const [field, value, note] of productIssues) issue("", p.code ?? p.name, field, value, note)
  }

  if (rows.length >= MAX_ROWS) {
    issues.unshift(["", "", "건수 초과", `${rows.length}건`, `코리안넷은 1회 ${MAX_ROWS}건 미만만 등록됩니다 — 필터로 나눠 받으세요`])
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([...GUIDE_ROWS, ...rows])
  ws["!cols"] = [
    { wch: 6 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 34 }, { wch: 8 }, { wch: 10 },
    { wch: 8 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 8 }, { wch: 10 }, { wch: 8 },
    { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 10 },
    { wch: 10 }, { wch: 12 }, { wch: 34 }, { wch: 40 }, { wch: 10 }, { wch: 10 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, "업로드 템플릿")

  const wsIssues = XLSX.utils.aoa_to_sheet([
    ["순번", "상품코드", "항목", "현재 값", "조치"],
    ...(issues.length ? issues : [["", "", "-", "-", "보정할 항목 없음"]]),
  ])
  wsIssues["!cols"] = [{ wch: 6 }, { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 50 }]
  XLSX.utils.book_append_sheet(wb, wsIssues, "(검증)")

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xls" })
  const fileName = `GS1_대량등록_${new Date().toISOString().split("T")[0]}.xls`
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.ms-excel",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}

export const GET = apiRoute(GET_impl, { retry: true })
