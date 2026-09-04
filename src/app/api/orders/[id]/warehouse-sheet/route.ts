import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"
import { apiRoute } from "@/lib/api-route"
import { sortSizeNames } from "@/lib/product-sizes"
import { renderSheet } from "@/lib/sheet-style"

/**
 * 창고에 보낼 발주서.
 *
 * 바이어 주문이 들어오면 먼저 이걸 뽑아 창고에 보낸다. 창고가 실물을
 * 확인해 수량을 적어 보내주면, 그 답을 보고 어드민에서 수량을 고친다.
 * 그래서 이 파일은 주문 그대로여야 하고 우리 전산 재고는 넣지 않는다.
 * 전산 재고는 주 1회 갱신되는 참고값이라 창고를 헷갈리게 할 뿐이다.
 *
 * layout=grid 사이즈를 가로로 (쓰던 오더시트 형태)
 * layout=rows 사이즈를 세로로 (한 줄에 한 품목, 피킹 목록에 가깝다)
 */
async function GET_impl(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const layout = request.nextUrl.searchParams.get("layout") === "rows" ? "rows" : "grid"

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, businessName: true } },
      items: {
        include: {
          variant: { select: { product: { select: { code: true } }, color: { select: { colorCode: true } } } },
        },
      },
    },
  })

  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
  }
  // 취소된 항목(수량 0)도 발주서에 싣는다. 지워서 보내면 창고는 앞서
  // 받은 발주서와 견줄 수 없어, 빠진 줄이 취소인지 우리 실수인지 알 수
  // 없다. 이미 꺼내 놓았을 수도 있으니 "빼라"고 명시해야 한다.
  const cancelledItems = order.items.filter((i) => i.quantity === 0)
  const sheetItems = order.items
  if (order.items.length === 0) {
    return NextResponse.json({ error: "품목이 없는 주문입니다." }, { status: 400 })
  }

  const codeOf = (item: (typeof order.items)[number]) =>
    item.variant?.product?.code || "-"

  // 창고는 WMS 와 대조하므로 컬러명 대신 컬러코드를 쓴다. 코드가 없는
  // 옛 상품만 이름으로 남긴다.
  const colorOf = (item: (typeof order.items)[number]) =>
    item.variant?.color?.colorCode || item.colorName

  // 열 순서를 직접 준다. "85", "90" 같은 숫자꼴 키를 객체에 담으면
  // 자바스크립트가 그 키들을 앞으로 끌어올려 품번보다 먼저 나온다.
  let header: string[] = []

  const rows: Record<string, unknown>[] =
    layout === "rows"
      ? // 한 줄에 한 품목. 확인수량 칸을 비워 두고 창고가 채워 보낸다.
        sheetItems
          .map((item) => ({
            품번: codeOf(item),
            상품명: item.productName,
            컬러: colorOf(item),
            사이즈: item.sizeName,
            주문수량: item.quantity,
            확인수량: item.quantity === 0 ? 0 : "",
            비고: item.quantity === 0 ? "바이어 취소 — 준비에서 빼주세요" : "",
            __cancelled: item.quantity === 0,
          }))
          .sort(
            (a, b) =>
              a.품번.localeCompare(b.품번) ||
              a.컬러.localeCompare(b.컬러) ||
              a.사이즈.localeCompare(b.사이즈),
          )
      : buildGrid()

  if (layout === "rows") {
    header = ["품번", "상품명", "컬러", "사이즈", "주문수량", "확인수량", "비고"]
  }

  /**
   * 사이즈를 가로로 펼친다. 품번 + 컬러가 한 줄이고 없는 사이즈는 빈 칸이다.
   * 창고는 이 칸의 숫자를 실물에 맞게 고쳐서 돌려보낸다.
   */
  function buildGrid(): Record<string, unknown>[] {
    const sizeCols = sortSizeNames([
      ...new Set(sheetItems.map((i) => i.sizeName)),
    ])
    header = ["품번", "상품명", "컬러", ...sizeCols, "주문합계", "비고"]

    const groups = new Map<string, Record<string, unknown>>()
    for (const item of sheetItems) {
      const key = `${codeOf(item)}|${colorOf(item)}`
      if (!groups.has(key)) {
        groups.set(key, {
          품번: codeOf(item),
          상품명: item.productName,
          컬러: colorOf(item),
          ...Object.fromEntries(sizeCols.map((c) => [c, ""])),
          주문합계: 0,
          비고: "",
        })
      }
      const g = groups.get(key)!
      g[item.sizeName] = ((g[item.sizeName] as number) || 0) + item.quantity
      g.주문합계 = (g.주문합계 as number) + item.quantity
      // 취소된 사이즈 칸을 적어둔다. 가로형은 줄이 아니라 칸 하나가
      // 취소되므로 줄 전체를 칠할 수 없다.
      if (item.quantity === 0) {
        ((g.__cancelledSizes ??= new Set<string>()) as Set<string>).add(item.sizeName)
      }
    }

    const out = [...groups.values()].sort(
      (a, b) =>
        String(a.품번).localeCompare(String(b.품번)) ||
        String(a.컬러).localeCompare(String(b.컬러)),
    )

    // 사이즈별 세로 합계. 어느 치수를 몇 장 꺼내야 하는지 한눈에 보인다.
    if (out.length > 1) {
      const total: Record<string, unknown> = { 품번: "합계", 상품명: "", 컬러: "" }
      for (const c of sizeCols) {
        const sum = out.reduce((s, r) => s + ((r[c] as number) || 0), 0)
        total[c] = sum || ""
      }
      total.주문합계 = out.reduce((s, r) => s + (r.주문합계 as number), 0)
      total.비고 = ""
      out.push(total)
    }
    return out
  }

  const buf = await renderSheet({
    sheetName: layout === "grid" ? "발주서(사이즈 가로)" : "발주서(사이즈 세로)",
    title: `발주서  ${order.orderNumber}`,
    subtitle: [
      `바이어: ${order.user?.businessName || order.user?.name || "-"}`,
      `주문일: ${new Date(order.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}`,
      `품목: ${sheetItems.length - cancelledItems.length}개` +
        (cancelledItems.length ? ` (취소 ${cancelledItems.length}개)` : ""),
    ].join("      "),
    notice:
      (layout === "grid"
        ? "실물 확인 후 사이즈 칸의 수량을 고쳐서 회신해 주세요."
        : "실물 확인 후 확인수량 칸을 채워서 회신해 주세요.") +
      (cancelledItems.length
        ? "  ※ 붉게 그은 칸은 바이어가 취소한 항목입니다. 준비에서 빼주세요."
        : ""),
    header,
    rows,
    // 창고가 채워 넣는 칸. 눈에 띄게 칠해 어디를 적어야 하는지 알린다.
    fillableColumns:
      layout === "grid"
        ? header.filter((h) => !["품번", "상품명", "컬러", "주문합계"].includes(h))
        : ["확인수량", "비고"],
    cancelled: (row, column) =>
      layout === "grid"
        ? ((row.__cancelledSizes as Set<string> | undefined)?.has(column) ?? false)
        : Boolean(row.__cancelled),
  })
  const filename = `발주서_${order.orderNumber}_${layout === "grid" ? "가로" : "세로"}.xlsx`

  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}

export const GET = apiRoute(GET_impl, { retry: true })

/**
 * 창고가 채워 보낸 발주서를 읽는다.
 *
 * 여기서 DB 를 고치지는 않는다. 읽은 수량을 조정 표에 채워 넣기만 하고,
 * 관리자가 눈으로 확인한 뒤 저장한다. 남이 만진 파일을 그대로 재고에
 * 반영하면 오타 하나가 주문을 망가뜨린다.
 *
 * 가로·세로 둘 다 받는다. 머리글 줄을 찾아 형식을 알아낸다.
 */
async function POST_impl(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const form = await request.formData()
  const file = form.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: { variant: { select: { product: { select: { code: true } }, color: { select: { colorCode: true } } } } },
      },
    },
  })
  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
  }

  let sheet: XLSX.WorkSheet
  try {
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" })
    const name = wb.SheetNames[0]
    if (!name) throw new Error("empty")
    sheet = wb.Sheets[name]
  } catch {
    return NextResponse.json(
      { error: "엑셀 파일을 읽지 못했습니다. 내려받은 발주서를 그대로 채워 올려주세요." },
      { status: 400 },
    )
  }

  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: true,
  })

  // 머리글 별칭. 창고가 우리 발주서 대신 자기네 양식(영문 수출 리스트 등)으로
  // 회신하는 경우가 있어 영어 이름도 받는다. 공백·점을 지우고 비교한다.
  const HEADER_ALIASES: Record<string, string[]> = {
    품번: ["품번", "styleno", "stylenumber", "sku", "itemno"],
    컬러: ["컬러", "color", "colour"],
    사이즈: ["사이즈", "size"],
    확인수량: ["확인수량", "quantitypcs", "quantity", "qty"],
  }
  const hnorm = (v: unknown) =>
    String(v ?? "").trim().toLowerCase().replace(/[\s.]/g, "")
  const matches = (cell: unknown, name: string) =>
    (HEADER_ALIASES[name] ?? [name]).includes(hnorm(cell))

  // 머리글 줄을 찾는다. 창고가 위에 줄을 넣거나 지울 수 있으므로
  // 4행이라고 못박지 않고 품번(별칭 포함)이 있는 줄을 찾는다.
  const headerRow = grid.findIndex(
    (r) => Array.isArray(r) && r.some((c) => matches(c, "품번")),
  )
  if (headerRow === -1) {
    return NextResponse.json(
      { error: "품번 열을 찾지 못했습니다. 내려받은 발주서를 그대로 채워 올려주세요." },
      { status: 400 },
    )
  }

  const header = (grid[headerRow] as unknown[]).map((c) => String(c ?? "").trim())
  const col = (name: string) => header.findIndex((h) => matches(h, name))
  const body = grid.slice(headerRow + 1) as unknown[][]

  const iCode = col("품번")
  const iColor = col("컬러")
  const isRows = col("사이즈") !== -1
  // 영문 머리글이면 창고 자체 양식(수출 리스트)이다. 해석 규칙이 다르다:
  // 준비 못 한 품목은 줄 자체를 빼고 보내므로 "파일에 없음 = 0"이고,
  // 같은 품목이 박스별로 여러 줄에 나뉘므로 합산한다.
  const isExport = hnorm(header[iCode]) !== "품번"

  // 사람이 손으로 만진 파일이라 앞뒤 공백과 대소문자가 섞여 들어온다.
  const norm = (v: unknown) => String(v ?? "").trim().toUpperCase()

  // (품번|컬러|사이즈) -> 주문 항목. 품번이 없는 옛 데이터는 상품명으로도 찾는다.
  const byKey = new Map<string, (typeof order.items)[number]>()
  for (const item of order.items) {
    const code = item.variant?.product?.code
    // 발주서가 컬러코드로 나가므로 코드·이름 어느 쪽으로도 찾아지게 한다
    const tails = [`${norm(item.colorName)}|${norm(item.sizeName)}`]
    const cc = item.variant?.color?.colorCode
    if (cc) tails.push(`${norm(cc)}|${norm(item.sizeName)}`)
    for (const tail of tails) {
      if (code) byKey.set(`${norm(code)}|${tail}`, item)
      byKey.set(`${norm(item.productName)}|${tail}`, item)
    }
  }

  // 이 주문에 실제로 있는 사이즈만 열로 인정한다. 그래야 창고가 담당자나
  // 메모 같은 열을 덧붙여도 그걸 사이즈로 잘못 읽지 않는다.
  const orderSizes = new Set(order.items.map((i) => norm(i.sizeName)))

  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || String(v).trim() === "") return null
    const n = Number(String(v).replace(/[, ]/g, ""))
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
  }

  // 주문에 없는데 창고가 수량을 적은 줄. 창고가 다른 상품을 끼워 넣었거나
  // 다른 주문의 발주서를 섞었을 수 있다. 조용히 넘기면 알 방법이 없다.
  const unmatched: { label: string; qty: number }[] = []
  // 파일에서 읽은 항목별 수량. null 은 칸이 비어 있었다는 뜻.
  const read = new Map<string, number | null>()

  // 사이즈로 인정하지 못한 열 중에 숫자가 적힌 것. 창고가 주문에 없는
  // 사이즈를 새로 만들어 적었을 수 있다.
  const knownCols = ["품번", "상품명", "컬러", "사이즈", "주문수량", "확인수량", "주문합계", "비고"]
  const strayCols = new Set<string>()

  for (const row of body) {
    if (!Array.isArray(row) || row.length === 0) continue
    const code = String(row[iCode] ?? "").trim()
    const color = String(row[iColor] ?? "").trim()
    // 합계 줄과 빈 줄은 건너뛴다
    if (!code || code === "합계" || !color) continue

    // 사이즈로 인정하지 못한 열에 숫자가 적혀 있으면 기억해 둔다
    if (!isRows) {
      header.forEach((h, idx) => {
        if (!h || knownCols.includes(h) || orderSizes.has(norm(h))) return
        if (num(row[idx])) strayCols.add(h)
      })
    }

    // 사이즈별로 (사이즈이름, 수량) 한 쌍씩 뽑는다
    const pairs: [string, unknown][] = isRows
      ? [[String(row[col("사이즈")] ?? "").trim(), row[col("확인수량")]]]
      : header
          .map((h, idx) => [h, row[idx]] as [string, unknown])
          // 주문에 있는 사이즈 이름을 가진 열만 읽는다
          .filter(([h]) => orderSizes.has(norm(h)))

    for (const [size, raw] of pairs) {
      if (!size) continue
      const item = byKey.get(`${norm(code)}|${norm(color)}|${norm(size)}`)
      if (!item) {
        // 주문에 없던 칸에 창고가 숫자를 적었을 수 있다. 0 이나 빈 칸은 조용히 넘긴다.
        const n = num(raw)
        if (n) unmatched.push({ label: `${code} / ${color} / ${size}`, qty: n })
        continue
      }
      const n = num(raw)
      if (isExport) {
        // 박스별로 줄이 나뉘어 같은 품목이 여러 번 나온다. 합산한다.
        const prev = read.get(item.id)
        read.set(item.id, n === null ? (prev ?? null) : (typeof prev === "number" ? prev + n : n))
      } else if (!read.has(item.id)) {
        read.set(item.id, n)
      }
    }
  }

  if (read.size === 0) {
    return NextResponse.json(
      { error: "이 주문과 맞는 줄을 찾지 못했습니다. 다른 주문의 발주서인지 확인해주세요." },
      { status: 400 },
    )
  }

  const labelOf = (item: (typeof order.items)[number]) =>
    `${item.variant?.product?.code || item.productName} / ${item.variant?.color?.colorCode || item.colorName} / ${item.sizeName}`

  const changes: { itemId: string; label: string; from: number; to: number }[] = []
  for (const item of order.items) {
    if (!read.has(item.id)) continue
    const n = read.get(item.id)!
    // 세로 형식에서 확인수량을 비워 두면 "그대로"라는 뜻이다.
    // 가로 형식에서는 빈 칸이 0 을 뜻하므로 0 으로 읽는다.
    const to = n === null ? (isRows ? item.quantity : 0) : n
    if (to !== item.quantity) {
      changes.push({ itemId: item.id, label: labelOf(item), from: item.quantity, to })
    }
  }

  // 수출 리스트는 준비 못 한 품목을 줄에서 아예 뺀다. 그 항목들은 0 으로
  // 채워서 표에 반영하고, 관리자가 볼 수 있게 따로 알린다.
  const zeroed: string[] = []
  if (isExport) {
    for (const item of order.items) {
      if (read.has(item.id)) continue
      // 이미 0 인 항목(앞서 취소된 것)은 발주서에 실리지도 않았다.
      // 다시 알리면 창고가 뺀 것처럼 보여 혼동을 준다.
      if (item.quantity === 0) continue
      zeroed.push(labelOf(item))
      changes.push({ itemId: item.id, label: labelOf(item), from: item.quantity, to: 0 })
    }
  }

  // 같은 줄이 여러 번 나와도 한 번만 알린다
  const unmatchedUnique = [...new Map(unmatched.map((u) => [u.label, u])).values()]

  return NextResponse.json({
    changes,
    unmatched: unmatchedUnique,
    strayColumns: [...strayCols],
    zeroed,
    // 파일에 아예 없던 항목. 창고가 줄을 지웠을 수 있어 그대로 두고 알린다.
    // (수출 리스트는 위에서 0 처리했으므로 여기 남지 않는다.)
    missing: isExport
      ? []
      : order.items.filter((i) => i.quantity > 0 && !read.has(i.id)).map(labelOf),
  })
}

export const POST = apiRoute(POST_impl, { retry: false })
