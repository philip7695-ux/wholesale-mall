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

// 엑셀 헤더 라벨(언어별). 값(품번·컬러·사이즈)은 매칭 키라 번역하지 않고,
// 사람이 읽는 헤더만 바이어 언어로 낸다.
const LABELS: Record<string, { image: string; code: string; name: string; color: string; price: string; sheet: string; file: string }> = {
  ko: { image: "이미지", code: "품번", name: "상품명", color: "컬러", price: "단가(도매)", sheet: "주문서", file: "주문서" },
  en: { image: "Image", code: "Style No.", name: "Product", color: "Color", price: "Unit Price", sheet: "Order Sheet", file: "order-sheet" },
  ja: { image: "画像", code: "品番", name: "商品名", color: "カラー", price: "単価", sheet: "注文書", file: "order-sheet" },
  zh: { image: "图片", code: "货号", name: "商品名", color: "颜色", price: "单价", sheet: "订单表", file: "order-sheet" },
}
// 업로드는 어떤 언어로 받은 파일이든 인식해야 한다. 각 필드의 모든 언어
// 라벨을 모아 매칭한다.
const anyLabel = (field: "image" | "code" | "name" | "color" | "price") =>
  new Set(Object.values(LABELS).map((l) => l[field]))
const CODE_LABELS = anyLabel("code")
// 사이즈 컬럼 판별용: 알려진(라벨) 열을 뺀 나머지가 사이즈
const KNOWN_LABELS = new Set<string>([
  ...anyLabel("image"),
  ...anyLabel("code"),
  ...anyLabel("name"),
  ...anyLabel("color"),
  ...anyLabel("price"),
  "단가", "수량", "Qty", "数量", "variantId", "",
])

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
  // 주문서는 영어로 통합한다(B2B 수출 표준). 업로드는 예전 한국어 파일도
  // 인식하도록 다국어 라벨을 계속 받아준다.
  const L = LABELS.en
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

  // 통합 사이즈 컬럼: 필터된 전 상품의 사이즈를 합쳐 정렬해 가로로 편다.
  // 스타일×컬러 한 줄에 사이즈별 수량(사이즈런)을 채우는 그리드 양식.
  const sizeColumns = sortSizeNames([
    ...new Set(products.flatMap((p) => p.sizes.map((s) => s.name))),
  ])

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(L.sheet, {
    // 품번·상품명·컬러(1~4열)까지 고정해 사이즈가 많아도 좌측이 안 밀린다.
    views: [{ state: "frozen", xSplit: 4, ySplit: 1 }],
  })

  const border = {
    top: { style: "thin" as const, color: { argb: "FFE0E0E0" } },
    left: { style: "thin" as const, color: { argb: "FFE0E0E0" } },
    bottom: { style: "thin" as const, color: { argb: "FFE0E0E0" } },
    right: { style: "thin" as const, color: { argb: "FFE0E0E0" } },
  }

  // 열: 이미지 | 품번 | 상품명 | 컬러 | <사이즈...> | 단가
  const IMG = 1, CODE = 2, NAME = 3, COLOR = 4
  const firstSizeCol = 5
  const priceCol = firstSizeCol + sizeColumns.length
  ws.columns = [
    { width: 11 }, // 이미지
    { width: 16 }, // 품번
    { width: 28 }, // 상품명
    { width: 14 }, // 컬러
    ...sizeColumns.map(() => ({ width: 6 })),
    { width: 12 }, // 단가
  ]

  const head = ws.getRow(1)
  head.getCell(IMG).value = L.image
  head.getCell(CODE).value = L.code
  head.getCell(NAME).value = L.name
  head.getCell(COLOR).value = L.color
  sizeColumns.forEach((s, i) => (head.getCell(firstSizeCol + i).value = s))
  head.getCell(priceCol).value = L.price
  head.height = 20
  head.eachCell((cell) => {
    cell.font = { bold: true, size: 10 }
    cell.alignment = { horizontal: "center", vertical: "middle" }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } }
    cell.border = border
  })

  let rowIdx = 2
  products.forEach((p, pi) => {
    const seasonRate = seasonRateFor(p.code, seasonRates)
    // 색상별로 한 줄. 색상 정렬은 sortOrder. 재고 여부와 무관하게 다 채울
    // 수 있게 낸다(업로드 시 재고만큼 조정된다).
    const colors = [...p.colors].sort((a, b) => a.sortOrder - b.sortOrder)
    const styleStartRow = rowIdx
    let styleHasRow = false
    for (const color of colors) {
      const colorVariants = p.variants.filter((v) => v.colorId === color.id)
      if (colorVariants.length === 0) continue
      const wholesale = buyerPrice(
        colorVariants[0].price,
        seasonRate,
        gradeRate,
        p.specialOffer ? specialOfferRate : 0,
      )
      const row = ws.getRow(rowIdx)
      row.getCell(CODE).value = p.code
      row.getCell(NAME).value = p.name
      row.getCell(COLOR).value = color.name
      row.getCell(priceCol).value = wholesale
      row.getCell(priceCol).numFmt = "#,##0"
      row.height = 18
      // 사이즈 칸: 해당 색상에 그 사이즈가 있으면 채울 칸(노랑), 없으면 막음(회색 -)
      sizeColumns.forEach((sizeName, i) => {
        const cell = row.getCell(firstSizeCol + i)
        const has = colorVariants.some((v) => v.size.name === sizeName)
        cell.alignment = { horizontal: "center" }
        if (has) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF9E6" } }
        } else {
          cell.value = "-"
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F0F0" } }
          cell.font = { color: { argb: "FFBBBBBB" } }
        }
      })
      row.eachCell((cell) => {
        if (!cell.border) cell.border = border
        else cell.border = border
      })
      styleHasRow = true
      rowIdx++
    }
    // 대표 이미지: 판매가능한 줄이 있을 때만, 스타일의 첫 행에 얹는다
    const t = thumbs[pi]
    if (t && styleHasRow) {
      const imgId = wb.addImage({ buffer: t.buffer as unknown as ExcelJS.Buffer, extension: t.extension })
      ws.getRow(styleStartRow).height = 56
      ws.addImage(imgId, {
        tl: { col: 0.1, row: styleStartRow - 1 + 0.08 },
        ext: { width: 52, height: 52 },
      })
    }
  })

  const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer
  const fileName = `${L.file}_${new Date().toISOString().split("T")[0]}.xlsx`
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

  // "품번"이 있는 줄을 머리글로 본다(가로·세로 양식 공통, 위에 안내문이 있어도 견딤).
  // 영어로 통합했지만 예전 한국어 파일도 인식하도록 모든 언어 라벨을 받아준다.
  const headerIdx = rows.findIndex(
    (r) => Array.isArray(r) && r.some((c) => CODE_LABELS.has(String(c ?? "").trim())),
  )
  if (headerIdx < 0) {
    return NextResponse.json({ error: "‘Style No.’(품번) column not found. Please upload the sheet as-is." }, { status: 400 })
  }
  const header = (rows[headerIdx] as unknown[]).map((c) => String(c ?? "").trim())
  const findIdx = (set: Set<string>) => header.findIndex((h) => set.has(h))
  const iVid = header.indexOf("variantId")
  const iQty = findIdx(new Set(["수량", "Qty", "数量"]))
  const iCode = findIdx(CODE_LABELS)
  const iColor = findIdx(anyLabel("color"))
  const iSize = findIdx(new Set(["사이즈", "Size", "サイズ", "尺码"]))

  // 가로(그리드) 양식의 사이즈 컬럼 = 알려진 라벨을 뺀 나머지 열
  const sizeCols = header.map((h, i) => ({ h, i })).filter((x) => !KNOWN_LABELS.has(x.h))

  // variantId 로 바로 잡히는 것과, 품번+컬러+사이즈로 찾아야 하는 것 분리
  const byVariant = new Map<string, number>()
  const needMatch: { code: string; color: string; size: string; qty: number }[] = []
  const styleKeys = new Set<string>()

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] as unknown[]
    if (!row) continue
    const code = iCode >= 0 ? String(row[iCode] ?? "").trim() : ""
    const color = iColor >= 0 ? String(row[iColor] ?? "").trim() : ""

    if (iQty >= 0) {
      // 세로(long) 양식 호환: 수량 열 하나
      const qty = Math.floor(Number(row[iQty]))
      if (!Number.isFinite(qty) || qty <= 0) continue
      const vid = iVid >= 0 ? String(row[iVid] ?? "").trim() : ""
      if (code) styleKeys.add(code)
      if (vid) byVariant.set(vid, (byVariant.get(vid) || 0) + qty)
      else if (code && iColor >= 0 && iSize >= 0) {
        needMatch.push({ code, color, size: String(row[iSize] ?? "").trim(), qty })
      }
    } else {
      // 가로(grid) 양식: 사이즈 컬럼마다 수량을 읽는다(사이즈런)
      if (!code) continue
      let rowHas = false
      for (const { h, i } of sizeCols) {
        const qty = Math.floor(Number(row[i]))
        if (!Number.isFinite(qty) || qty <= 0) continue
        needMatch.push({ code, color, size: h, qty })
        rowHas = true
      }
      if (rowHas) styleKeys.add(code)
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

  const ids = [...byVariant.keys()]
  // 변형의 재고·예약, 품번·컬러·사이즈, 그리고 이 바이어의 기존 장바구니 수량.
  const [variants, existingItems] = await Promise.all([
    prisma.productVariant.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, stock: true, reserved: true,
        product: { select: { isActive: true, code: true } },
        color: { select: { name: true } },
        size: { select: { name: true } },
      },
    }),
    prisma.cartItem.findMany({
      where: { userId: session.user.id, variantId: { in: ids } },
      select: { variantId: true, quantity: true },
    }),
  ])
  const vById = new Map(variants.map((v) => [v.id, v]))
  const existingQty = new Map(existingItems.map((c) => [c.variantId, c.quantity]))

  // 주문은 통과시키되 수량을 판매가능(재고−예약)에 맞춰 조정한다.
  // 재고 0이면 0(담기지 않음), 재고가 주문량보다 적으면 재고만큼.
  // 조정된 항목은 주문량→재고량으로 바이어에게 보여준다.
  let added = 0
  const adjusted: { code: string; color: string; size: string; requested: number; available: number }[] = []
  for (const [variantId, requested] of byVariant) {
    const v = vById.get(variantId)
    if (!v || !v.product.isActive) continue
    const available = Math.max(0, v.stock - v.reserved)
    const existing = existingQty.get(variantId) ?? 0
    const capped = Math.min(existing + requested, available)
    // 재고가 주문량(기존+요청)에 못 미치면 조정 내역에 남긴다(재고 0 포함).
    if (available < existing + requested) {
      adjusted.push({
        code: v.product.code || "",
        color: v.color.name,
        size: v.size.name,
        requested,
        available,
      })
    }
    if (capped <= 0) continue // 재고 0 → 담지 않음(있던 것도 유지)
    await prisma.cartItem.upsert({
      where: { userId_variantId: { userId: session.user.id, variantId } },
      update: { quantity: capped },
      create: { userId: session.user.id, variantId, quantity: capped },
    })
    added++
  }

  return NextResponse.json({
    added,
    styles: styleKeys.size,
    adjustedCount: adjusted.length,
    adjusted: adjusted.slice(0, 50),
    unresolved: unresolved.slice(0, 20),
    unresolvedCount: unresolved.length,
  })
}
