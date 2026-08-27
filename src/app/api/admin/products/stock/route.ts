import { NextRequest, NextResponse } from "next/server"

// WMS 원본(3만 행 가까이)을 받을 수 있어 여유를 둔다
export const maxDuration = 60
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"
import { ALL_SIZES } from "@/lib/product-sizes"
import { apiRoute } from "@/lib/api-route"

// GET: 재고 현황 엑셀 다운로드
async function GET_impl(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      colors: { orderBy: { sortOrder: "asc" } },
      sizes: { orderBy: { sortOrder: "asc" } },
      variants: {
        include: { color: true, size: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // 전체에서 사용되는 사이즈 수집 (정렬)
  const allUsedSizes = new Set<string>()
  for (const p of products) {
    for (const s of p.sizes) {
      allUsedSizes.add(s.name)
    }
  }
  const sizeColumns = [...allUsedSizes].sort((a, b) => {
    const ai = ALL_SIZES.indexOf(a)
    const bi = ALL_SIZES.indexOf(b)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  // 세로형: 행마다 사이즈 하나(사이즈·재고 열). 대량등록 세로형과 같은 감각.
  const vertical = request.nextUrl.searchParams.get("layout") === "rows"
  if (vertical) {
    const vHeaders = ["상품코드", "상품명", "컬러명", "컬러코드", "가격", "사이즈", "재고"]
    const vRows: (string | number)[][] = []
    for (const product of products) {
      for (const color of product.colors) {
        const colorVariants = product.variants
          .filter((v) => v.colorId === color.id)
          .sort((a, b) => {
            const ai = ALL_SIZES.indexOf(a.size.name); const bi = ALL_SIZES.indexOf(b.size.name)
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
          })
        for (const v of colorVariants) {
          vRows.push([product.code || "", product.name, color.name, color.colorCode || "", v.price, v.size.name, v.stock])
        }
      }
    }
    const wbV = XLSX.utils.book_new()
    const wsV = XLSX.utils.aoa_to_sheet([vHeaders, ...vRows])
    wsV["!cols"] = [{ wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 8 }]
    XLSX.utils.book_append_sheet(wbV, wsV, "재고현황")
    const bufV = XLSX.write(wbV, { type: "buffer", bookType: "xlsx" })
    const fileNameV = `재고현황_세로형_${new Date().toISOString().split("T")[0]}.xlsx`
    return new NextResponse(bufV, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileNameV)}`,
      },
    })
  }

  const baseHeaders = ["상품코드", "상품명", "컬러명", "컬러코드", "가격"]
  const headers = [...baseHeaders, ...sizeColumns]

  const rows: (string | number)[][] = []
  for (const product of products) {
    for (const color of product.colors) {
      const row: (string | number)[] = [
        product.code || "",
        product.name,
        color.name,
        color.colorCode || "",
        // 해당 컬러의 첫 번째 variant 가격
        product.variants.find((v) => v.colorId === color.id)?.price ?? 0,
      ]
      // 사이즈별 재고
      for (const sizeName of sizeColumns) {
        const variant = product.variants.find(
          (v) => v.colorId === color.id && v.size.name === sizeName
        )
        row.push(variant ? variant.stock : "")
      }
      rows.push(row)
    }
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
  ws["!cols"] = [
    { wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 8 }, { wch: 10 },
    ...sizeColumns.map(() => ({ wch: 8 })),
  ]
  XLSX.utils.book_append_sheet(wb, ws, "재고현황")

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  const fileName = `재고현황_${new Date().toISOString().split("T")[0]}.xlsx`

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    },
  })
}

// POST: 재고 업데이트 엑셀 업로드
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buffer, { type: "buffer" })

    const ws = wb.Sheets[wb.SheetNames[0]]
    if (!ws) return NextResponse.json({ error: "시트가 없습니다." }, { status: 400 })

    const rows = XLSX.utils.sheet_to_json(ws) as Record<string, any>[]
    if (rows.length === 0) return NextResponse.json({ error: "데이터가 없습니다." }, { status: 400 })

    // ── 창고(WMS) 원본 형식 지원 ────────────────────────────────────
    // 헤더: 창고코드/로케이션코드/zone명/품목코드/스타일코드/색상/사이즈/총 재고
    // (헤더에 후행 공백이 섞여 있어 trim 해서 본다.) 로케이션별 행을
    // 스타일×색상×사이즈로 합산해 몰 재고에 반영한다. 몰에 등록하지 않은
    // 상품·컬러·사이즈는 반영하지 않고 요약으로만 알린다.
    {
      const keyMap = new Map(Object.keys(rows[0]).map((k) => [k.trim(), k]))
      const has = (k: string) => keyMap.has(k)
      if (has("스타일코드") && has("색상") && has("사이즈") && (has("총 재고") || has("총재고"))) {
        const get = (row: Record<string, any>, k: string) => row[keyMap.get(k)!]
        const stockKey = has("총 재고") ? "총 재고" : "총재고"

        // 1) 로케이션 합산: 스타일|색상코드|사이즈 → 총재고
        const agg = new Map<string, number>()
        for (const row of rows) {
          const style = String(get(row, "스타일코드") ?? "").trim()
          const colorCode = String(get(row, "색상") ?? "").trim().toUpperCase()
          const size = String(get(row, "사이즈") ?? "").trim()
          const qty = Number(get(row, stockKey))
          if (!style || !colorCode || !size || !Number.isFinite(qty)) continue
          const k = `${style}|${colorCode}|${size}`
          agg.set(k, (agg.get(k) ?? 0) + qty)
        }

        // 2) 몰 상품 일괄 조회 후 variant 매핑
        const styles = [...new Set([...agg.keys()].map((k) => k.split("|")[0]))]
        const prods = await prisma.product.findMany({
          where: { code: { in: styles } },
          select: {
            id: true, code: true,
            colors: { select: { id: true, name: true, colorCode: true } },
            variants: { select: { id: true, colorId: true, size: { select: { name: true } } } },
          },
        })
        const registered = new Set(prods.map((p) => p.code!))
        const variantOf = new Map<string, string>() // style|COLORCODE|size → variantId
        for (const p of prods) {
          const colorByCode = new Map(p.colors.map((c) => [(c.colorCode || "").toUpperCase(), c.id]))
          const colorIdToKey = new Map(p.colors.map((c) => [c.id, (c.colorCode || c.name).toUpperCase()]))
          void colorByCode
          for (const v of p.variants) {
            const ck = colorIdToKey.get(v.colorId)
            if (ck) variantOf.set(`${p.code}|${ck}|${v.size.name}`, v.id)
          }
        }

        // 3) 반영 대상/미등록 분류
        const ids: string[] = []
        const stocks: number[] = []
        const unregisteredStyles = new Set<string>()
        let unmatchedCombos = 0
        const unmatchedSample: string[] = []
        for (const [k, qty] of agg) {
          const [style] = k.split("|")
          if (!registered.has(style)) {
            unregisteredStyles.add(style)
            continue
          }
          const vid = variantOf.get(k)
          if (!vid) {
            unmatchedCombos++
            if (unmatchedSample.length < 10) unmatchedSample.push(k.replace(/\|/g, "/"))
            continue
          }
          ids.push(vid)
          stocks.push(Math.max(0, Math.round(qty)))
        }

        // 4) 단일 SQL 로 일괄 갱신 (수만 건도 한 방)
        let updated = 0
        if (ids.length) {
          updated = await prisma.$executeRaw`
            update mall."ProductVariant" v
            set stock = d.stock, "updatedAt" = now()
            from (select unnest(${ids}::text[]) as id, unnest(${stocks}::int[]) as stock) d
            where v.id = d.id`
          // 판매가능 집계 갱신
          await prisma.$executeRaw`
            update mall."Product" p set
              "inStock" = exists (
                select 1 from mall."ProductVariant" v
                where v."productId" = p.id and v.stock - v.reserved > 0
              ),
              "totalStock" = coalesce((
                select sum(greatest(v.stock - v.reserved, 0))::int
                from mall."ProductVariant" v where v."productId" = p.id
              ), 0)
            where p.code = any(${styles})`
        }

        // 5) 미등록은 행별 에러 폭탄 대신 요약으로
        const failed: { row: number; error: string }[] = []
        if (unregisteredStyles.size) {
          const list = [...unregisteredStyles]
          failed.push({
            row: 0,
            error: `등록하지 않은 상품 ${list.length}개 스타일 — 재고 반영 안 함: ${list.slice(0, 20).join(", ")}${list.length > 20 ? ` 외 ${list.length - 20}개` : ""}`,
          })
        }
        if (unmatchedCombos) {
          failed.push({
            row: 0,
            error: `등록된 상품이지만 몰에 없는 컬러/사이즈 ${unmatchedCombos}건 — 반영 안 함 (예: ${unmatchedSample.join(", ")})`,
          })
        }
        return NextResponse.json({ updated, failed })
      }
    }

    // 세로형(사이즈·재고 열)이면 가로형 한 줄(컬러당)로 합쳐 기존 로직을 태운다.
    let workRows: Record<string, any>[] = rows
    if ("사이즈" in rows[0] && "재고" in rows[0]) {
      const byKey = new Map<string, Record<string, any>>()
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        const code = String(r["상품코드"] ?? "").trim()
        const name = String(r["상품명"] ?? "").trim()
        const colorName = String(r["컬러명"] ?? "").trim()
        const size = String(r["사이즈"] ?? "").trim()
        const key = `${code}|${name}|${colorName}`
        if (!byKey.has(key)) {
          byKey.set(key, { 상품코드: code, 상품명: name, 컬러명: colorName, 컬러코드: String(r["컬러코드"] ?? "").trim(), __row: i + 2 })
        }
        if (size !== "") byKey.get(key)![size] = r["재고"]
      }
      workRows = [...byKey.values()]
    }

    // 헤더에서 사이즈 컬럼 추출 (기본 컬럼 제외한 나머지가 사이즈)
    const baseKeys = new Set(["상품코드", "상품명", "컬러명", "컬러코드", "가격", "사이즈", "재고", "__row"])
    const sizeColumns = [...new Set(workRows.flatMap((r) => Object.keys(r)))].filter((k) => !baseKeys.has(k))

    let updated = 0
    const failed: { row: number; error: string }[] = []

    for (let i = 0; i < workRows.length; i++) {
      const row = workRows[i]
      const rowNum = Number(row.__row) || i + 2
      const code = String(row["상품코드"] ?? "").trim()
      const name = String(row["상품명"] ?? "").trim()
      const colorName = String(row["컬러명"] ?? "").trim()
      const colorCodeIn = String(row["컬러코드"] ?? "").trim()

      if (!name && !code) {
        failed.push({ row: rowNum, error: "상품코드 또는 상품명이 필요합니다." })
        continue
      }
      if (!colorName && !colorCodeIn) {
        failed.push({ row: rowNum, error: "컬러명(또는 컬러코드)이 비어있습니다." })
        continue
      }

      // 상품 찾기: 상품코드 우선, 없으면 상품명
      const product = code
        ? await prisma.product.findFirst({
            where: { code },
            include: {
              colors: true,
              sizes: true,
              variants: { include: { color: true, size: true } },
            },
          })
        : await prisma.product.findFirst({
            where: { name },
            include: {
              colors: true,
              sizes: true,
              variants: { include: { color: true, size: true } },
            },
          })

      if (!product) {
        failed.push({ row: rowNum, error: `상품을 찾을 수 없습니다: ${code || name}` })
        continue
      }

      // 컬러코드 우선(창고 시스템과의 대조 기준), 없으면 이름으로
      const color =
        (colorCodeIn &&
          product.colors.find((c) => (c.colorCode || "").toUpperCase() === colorCodeIn.toUpperCase())) ||
        product.colors.find((c) => c.name === colorName)
      if (!color) {
        failed.push({ row: rowNum, error: `컬러를 찾을 수 없습니다: ${colorName || colorCodeIn} (상품: ${product.name})` })
        continue
      }

      // 사이즈별 재고 업데이트
      // 빈 셀 = 변경 없음, 숫자 > 0 = 재고 설정 (없으면 생성), 0 = variant 삭제
      for (const sizeName of sizeColumns) {
        const val = row[sizeName]
        if (val === undefined || val === null || val === "") continue

        const stock = Number(val)
        if (isNaN(stock)) continue

        const variant = product.variants.find(
          (v) => v.colorId === color.id && v.size.name === sizeName
        )

        if (stock <= 0) {
          // 0 입력 → variant 삭제 (해당 사이즈 제거)
          if (variant) {
            await prisma.productVariant.delete({ where: { id: variant.id } })
            // 해당 사이즈에 다른 variant가 없으면 ProductSize도 삭제
            const remainingVariants = await prisma.productVariant.count({
              where: { productId: product.id, sizeId: variant.sizeId },
            })
            if (remainingVariants === 0) {
              await prisma.productSize.delete({ where: { id: variant.sizeId } })
            }
            updated++
          }
        } else if (variant) {
          // 기존 variant 재고 업데이트
          await prisma.productVariant.update({
            where: { id: variant.id },
            data: { stock },
          })
          updated++
        } else {
          // variant가 없으면 사이즈 확인/생성 후 variant 생성
          let size = product.sizes.find((s) => s.name === sizeName)
          if (!size) {
            size = await prisma.productSize.create({
              data: {
                productId: product.id,
                name: sizeName,
                sortOrder: ALL_SIZES.indexOf(sizeName) >= 0 ? ALL_SIZES.indexOf(sizeName) : 999,
              },
            })
          }
          const price = product.variants.find((v) => v.colorId === color.id)?.price ?? 0
          await prisma.productVariant.create({
            data: {
              productId: product.id,
              colorId: color.id,
              sizeId: size.id,
              price,
              stock,
            },
          })
          updated++
        }
      }
    }

    return NextResponse.json({ updated, failed })
  } catch (error) {
    console.error("Stock update error:", error)
    return NextResponse.json({ error: "재고 업데이트 처리 중 오류가 발생했습니다." }, { status: 500 })
  }
}

export const GET = apiRoute(GET_impl, { retry: true })
