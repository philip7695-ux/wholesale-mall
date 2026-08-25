import { NextResponse } from "next/server"
import ExcelJS from "exceljs"
import * as XLSX from "xlsx"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { buildProductWhere } from "@/lib/product-filter"
import { getSeasonRates, getSpecialOfferRate } from "@/lib/pricing.server"
import { getGradeDiscount } from "@/lib/grade.server"
import { buyerPrice, seasonRateFor } from "@/lib/pricing"
import { sortSizeNames } from "@/lib/product-sizes"

// 한 번에 받을 수 있는 최대 스타일 수. 너무 많으면 이미지 삽입으로 파일이
// 커지고 생성이 느려져 오류가 나기 쉽다.
const STYLE_LIMIT = 300

const HEADER = ["이미지", "품번", "상품명", "컬러", "사이즈", "단가(도매)", "수량", "variantId"] as const

// Cloudinary 원본은 크므로 작은 썸네일로 변환해 가져온다(파일 크기·속도).
function thumbUrl(url: string): string {
  if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
    return url.replace("/upload/", "/upload/w_140,h_140,c_fit,q_auto/")
  }
  return url
}

// ── 다운로드: 필터된 상품을 이미지 포함 주문서 엑셀로 ──────────────
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sp = new URL(request.url).searchParams
  const where = buildProductWhere({
    category: sp.get("category") || undefined,
    season: sp.get("season") || undefined,
    ageGroup: sp.get("ageGroup") || undefined,
    search: sp.get("search") || undefined,
    specialOnly: sp.get("special") === "1",
  })

  const count = await prisma.product.count({ where })
  if (count === 0) {
    return NextResponse.json({ error: "필터에 해당하는 상품이 없습니다." }, { status: 400 })
  }
  if (count > STYLE_LIMIT) {
    return NextResponse.json(
      { error: `필터 결과가 ${count}개 스타일입니다. 한 번에 최대 ${STYLE_LIMIT}개까지만 받을 수 있어요. 필터를 더 좁혀주세요.` },
      { status: 400 },
    )
  }

  const products = await prisma.product.findMany({
    where,
    include: {
      colors: { orderBy: { sortOrder: "asc" } },
      sizes: true,
      variants: { include: { color: true, size: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const [seasonRates, gradeRate, specialOfferRate] = await Promise.all([
    getSeasonRates(),
    getGradeDiscount(session.user.buyerGrade || "BRONZE").catch(() => 0),
    getSpecialOfferRate(),
  ])

  // 대표 이미지(누끼컷) 썸네일을 병렬로 가져온다. 실패는 건너뛴다.
  const thumbs = await Promise.all(
    products.map(async (p) => {
      if (!p.thumbnail) return null
      try {
        const res = await fetch(thumbUrl(p.thumbnail))
        if (!res.ok) return null
        const ct = res.headers.get("content-type") || ""
        const extension: "jpeg" | "png" | "gif" = ct.includes("png")
          ? "png"
          : ct.includes("gif")
            ? "gif"
            : "jpeg"
        return { buffer: Buffer.from(await res.arrayBuffer()), extension }
      } catch {
        return null
      }
    }),
  )

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("주문서", {
    views: [{ state: "frozen", ySplit: 1 }],
  })
  ws.columns = [
    { header: HEADER[0], width: 11 },
    { header: HEADER[1], width: 16 },
    { header: HEADER[2], width: 30 },
    { header: HEADER[3], width: 14 },
    { header: HEADER[4], width: 8 },
    { header: HEADER[5], width: 12 },
    { header: HEADER[6], width: 9 },
    { header: HEADER[7], width: 24 },
  ]
  // 머리글 스타일
  const head = ws.getRow(1)
  head.height = 20
  head.eachCell((cell) => {
    cell.font = { bold: true, size: 10 }
    cell.alignment = { horizontal: "center", vertical: "middle" }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }
  })
  // variantId 는 매칭용이라 숨긴다(바이어가 지우면 안 됨)
  ws.getColumn(8).hidden = true

  let rowIdx = 2
  products.forEach((p, pi) => {
    const sizeOrder = sortSizeNames(p.sizes.map((s) => s.name))
    const sortedVariants = [...p.variants].sort(
      (a, b) =>
        a.color.sortOrder - b.color.sortOrder ||
        sizeOrder.indexOf(a.size.name) - sizeOrder.indexOf(b.size.name),
    )
    const styleStartRow = rowIdx
    for (const v of sortedVariants) {
      const wholesale = buyerPrice(
        v.price,
        seasonRateFor(p.code, seasonRates),
        gradeRate,
        p.specialOffer ? specialOfferRate : 0,
      )
      const row = ws.getRow(rowIdx)
      row.getCell(2).value = p.code
      row.getCell(3).value = p.name
      row.getCell(4).value = v.color.name
      row.getCell(5).value = v.size.name
      row.getCell(6).value = wholesale
      row.getCell(6).numFmt = "#,##0"
      // 수량 칸: 바이어가 채우는 자리. 옅게 칠해 표시한다.
      const qtyCell = row.getCell(7)
      qtyCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF9E6" } }
      qtyCell.alignment = { horizontal: "center" }
      row.getCell(8).value = v.id
      row.height = 18
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE0E0E0" } },
          left: { style: "thin", color: { argb: "FFE0E0E0" } },
          bottom: { style: "thin", color: { argb: "FFE0E0E0" } },
          right: { style: "thin", color: { argb: "FFE0E0E0" } },
        }
      })
      rowIdx++
    }
    // 대표 이미지: 스타일의 첫 행에 얹는다
    const t = thumbs[pi]
    if (t) {
      const imgId = wb.addImage({ buffer: t.buffer as unknown as ExcelJS.Buffer, extension: t.extension })
      ws.getRow(styleStartRow).height = 56
      ws.addImage(imgId, {
        tl: { col: 0.1, row: styleStartRow - 1 + 0.08 },
        ext: { width: 52, height: 52 },
      })
    }
  })

  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer
  const fileName = `주문서_${new Date().toISOString().split("T")[0]}.xlsx`
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}

// ── 업로드: 채워진 주문서를 읽어 장바구니에 담는다 ──────────────────
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  let rows: unknown[][]
  try {
    const wb = XLSX.read(buffer, { type: "buffer" })
    const ws = wb.Sheets[wb.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }) as unknown[][]
  } catch {
    return NextResponse.json({ error: "엑셀 파일을 읽을 수 없습니다." }, { status: 400 })
  }

  // "수량"이 있는 줄을 머리글로 본다(양식 위에 안내문이 있어도 견딘다).
  const headerIdx = rows.findIndex(
    (r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() === "수량"),
  )
  if (headerIdx < 0) {
    return NextResponse.json({ error: "‘수량’ 열을 찾을 수 없습니다. 받은 양식 그대로 올려주세요." }, { status: 400 })
  }
  const header = (rows[headerIdx] as unknown[]).map((c) => String(c ?? "").trim())
  const idx = (name: string) => header.indexOf(name)
  const iVid = idx("variantId")
  const iQty = idx("수량")
  const iCode = idx("품번")
  const iColor = idx("컬러")
  const iSize = idx("사이즈")

  // variantId 로 바로 잡히는 것과, 품번+컬러+사이즈로 찾아야 하는 것 분리
  const byVariant = new Map<string, number>()
  const needMatch: { code: string; color: string; size: string; qty: number }[] = []
  const styleKeys = new Set<string>()

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] as unknown[]
    if (!row) continue
    const qty = Math.floor(Number(row[iQty]))
    if (!Number.isFinite(qty) || qty <= 0) continue

    const vid = iVid >= 0 ? String(row[iVid] ?? "").trim() : ""
    const code = iCode >= 0 ? String(row[iCode] ?? "").trim() : ""
    if (code) styleKeys.add(code)

    if (vid) {
      byVariant.set(vid, (byVariant.get(vid) || 0) + qty)
    } else if (code && iColor >= 0 && iSize >= 0) {
      needMatch.push({
        code,
        color: String(row[iColor] ?? "").trim(),
        size: String(row[iSize] ?? "").trim(),
        qty,
      })
    }
  }

  if (styleKeys.size > STYLE_LIMIT) {
    return NextResponse.json(
      { error: `${styleKeys.size}개 스타일이 들어 있습니다. 한 번에 최대 ${STYLE_LIMIT}개까지만 주문할 수 있어요.` },
      { status: 400 },
    )
  }

  // 품번+컬러+사이즈로 variantId 를 찾는다(직접 만든 양식 대응)
  const unresolved: string[] = []
  if (needMatch.length) {
    const codes = [...new Set(needMatch.map((m) => m.code))]
    const prods = await prisma.product.findMany({
      where: { code: { in: codes } },
      select: { code: true, variants: { select: { id: true, color: { select: { name: true } }, size: { select: { name: true } } } } },
    })
    const lookup = new Map<string, string>() // code|color|size → variantId
    for (const p of prods) {
      for (const v of p.variants) {
        lookup.set(`${p.code}|${v.color.name}|${v.size.name}`, v.id)
      }
    }
    for (const m of needMatch) {
      const vid = lookup.get(`${m.code}|${m.color}|${m.size}`)
      if (vid) byVariant.set(vid, (byVariant.get(vid) || 0) + m.qty)
      else unresolved.push(`${m.code} ${m.color}/${m.size}`)
    }
  }

  if (byVariant.size === 0) {
    return NextResponse.json({ error: "수량이 입력된 행이 없습니다." }, { status: 400 })
  }

  // 유효한 변형만 장바구니에 담는다(누적 upsert). 비활성/삭제된 건 건너뛴다.
  const validVariants = await prisma.productVariant.findMany({
    where: { id: { in: [...byVariant.keys()] } },
    select: { id: true, product: { select: { isActive: true } } },
  })
  const validSet = new Set(validVariants.filter((v) => v.product.isActive).map((v) => v.id))

  let added = 0
  let skipped = 0
  for (const [variantId, quantity] of byVariant) {
    if (!validSet.has(variantId)) {
      skipped++
      continue
    }
    await prisma.cartItem.upsert({
      where: { userId_variantId: { userId: session.user.id, variantId } },
      update: { quantity: { increment: quantity } },
      create: { userId: session.user.id, variantId, quantity },
    })
    added++
  }

  return NextResponse.json({
    added,
    styles: styleKeys.size,
    skipped,
    unresolved: unresolved.slice(0, 20),
    unresolvedCount: unresolved.length,
  })
}
