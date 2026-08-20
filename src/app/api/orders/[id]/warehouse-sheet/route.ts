import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"
import { apiRoute } from "@/lib/api-route"
import { sortSizeNames } from "@/lib/product-sizes"

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
          variant: { select: { product: { select: { code: true } } } },
        },
      },
    },
  })

  if (!order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
  }
  if (order.items.length === 0) {
    return NextResponse.json({ error: "품목이 없는 주문입니다." }, { status: 400 })
  }

  const codeOf = (item: (typeof order.items)[number]) =>
    item.variant?.product?.code || "-"

  // 열 순서를 직접 준다. "85", "90" 같은 숫자꼴 키를 객체에 담으면
  // 자바스크립트가 그 키들을 앞으로 끌어올려 품번보다 먼저 나온다.
  let header: string[] = []

  const rows: Record<string, unknown>[] =
    layout === "rows"
      ? // 한 줄에 한 품목. 확인수량 칸을 비워 두고 창고가 채워 보낸다.
        order.items
          .map((item) => ({
            품번: codeOf(item),
            상품명: item.productName,
            컬러: item.colorName,
            사이즈: item.sizeName,
            주문수량: item.quantity,
            확인수량: "",
            비고: "",
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
      ...new Set(order!.items.map((i) => i.sizeName)),
    ])
    header = ["품번", "상품명", "컬러", ...sizeCols, "주문합계", "비고"]

    const groups = new Map<string, Record<string, unknown>>()
    for (const item of order!.items) {
      const key = `${codeOf(item)}|${item.colorName}`
      if (!groups.has(key)) {
        groups.set(key, {
          품번: codeOf(item),
          상품명: item.productName,
          컬러: item.colorName,
          ...Object.fromEntries(sizeCols.map((c) => [c, ""])),
          주문합계: 0,
          비고: "",
        })
      }
      const g = groups.get(key)!
      g[item.sizeName] = ((g[item.sizeName] as number) || 0) + item.quantity
      g.주문합계 = (g.주문합계 as number) + item.quantity
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

  const wb = XLSX.utils.book_new()
  // 머리말 세 줄을 비워 두고 표를 4행부터 놓는다
  const ws = XLSX.utils.json_to_sheet([])
  XLSX.utils.sheet_add_json(ws, rows, { origin: "A4", header })

  // 창고가 어느 주문인지, 무엇을 해야 하는지 위에 적어 둔다
  XLSX.utils.sheet_add_aoa(
    ws,
    [
      [
        `발주서  ${order.orderNumber}`,
        "",
        `바이어: ${order.user?.businessName || order.user?.name || "-"}`,
        "",
        `주문일: ${new Date(order.createdAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}`,
      ],
      [
        layout === "grid"
          ? "실물 확인 후 사이즈 칸의 수량을 고쳐서 회신해 주세요."
          : "실물 확인 후 확인수량 칸을 채워서 회신해 주세요.",
      ],
      [],
    ],
    { origin: "A1" },
  )

  const cols = header.map((key) => {
    const maxLen = Math.max(
      key.length * 2,
      ...rows.map((r) => String(r[key] ?? "").length),
    )
    return { wch: Math.min(maxLen + 2, 30) }
  })
  ws["!cols"] = cols

  XLSX.utils.book_append_sheet(
    wb,
    ws,
    layout === "grid" ? "발주서(사이즈 가로)" : "발주서(사이즈 세로)",
  )

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
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
        include: { variant: { select: { product: { select: { code: true } } } } },
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

  // 머리글 줄을 찾는다. 창고가 위에 줄을 넣거나 지울 수 있으므로
  // 4행이라고 못박지 않고 "품번"이 있는 줄을 찾는다.
  const headerRow = grid.findIndex(
    (r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() === "품번"),
  )
  if (headerRow === -1) {
    return NextResponse.json(
      { error: "품번 열을 찾지 못했습니다. 내려받은 발주서를 그대로 채워 올려주세요." },
      { status: 400 },
    )
  }

  const header = (grid[headerRow] as unknown[]).map((c) => String(c ?? "").trim())
  const col = (name: string) => header.indexOf(name)
  const body = grid.slice(headerRow + 1) as unknown[][]

  const iCode = col("품번")
  const iColor = col("컬러")
  const isRows = col("사이즈") !== -1

  // (품번|컬러|사이즈) -> 주문 항목. 품번이 없는 옛 데이터는 상품명으로도 찾는다.
  const byKey = new Map<string, (typeof order.items)[number]>()
  for (const item of order.items) {
    const code = item.variant?.product?.code
    if (code) byKey.set(`${code}|${item.colorName}|${item.sizeName}`, item)
    byKey.set(`${item.productName}|${item.colorName}|${item.sizeName}`, item)
  }

  const num = (v: unknown): number | null => {
    if (v === null || v === undefined || String(v).trim() === "") return null
    const n = Number(String(v).replace(/[, ]/g, ""))
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
  }

  const changes: { itemId: string; label: string; from: number; to: number }[] = []
  const unmatched: string[] = []
  const seen = new Set<string>()

  for (const row of body) {
    if (!Array.isArray(row) || row.length === 0) continue
    const code = String(row[iCode] ?? "").trim()
    const color = String(row[iColor] ?? "").trim()
    // 합계 줄과 빈 줄은 건너뛴다
    if (!code || code === "합계" || !color) continue

    // 사이즈별로 (사이즈이름, 수량) 한 쌍씩 뽑는다
    const pairs: [string, unknown][] = isRows
      ? [[String(row[col("사이즈")] ?? "").trim(), row[col("확인수량")]]]
      : header
          .map((h, idx) => [h, row[idx]] as [string, unknown])
          .filter(
            ([h]) => !["품번", "상품명", "컬러", "주문합계", "비고"].includes(h) && h !== "",
          )

    for (const [size, raw] of pairs) {
      if (!size) continue
      const item = byKey.get(`${code}|${color}|${size}`)
      if (!item) {
        // 주문에 없던 칸에 창고가 숫자를 적었을 수 있다. 0 이나 빈 칸은 조용히 넘긴다.
        const n = num(raw)
        if (n) unmatched.push(`${code} / ${color} / ${size}`)
        continue
      }
      if (seen.has(item.id)) continue

      const n = num(raw)
      // 세로 형식에서 확인수량을 비워 두면 "그대로"라는 뜻이다.
      // 가로 형식에서는 빈 칸이 0 을 뜻하므로 0 으로 읽는다.
      const to = n === null ? (isRows ? item.quantity : 0) : n
      seen.add(item.id)
      if (to !== item.quantity) {
        changes.push({
          itemId: item.id,
          label: `${code} / ${color} / ${size}`,
          from: item.quantity,
          to,
        })
      }
    }
  }

  if (seen.size === 0) {
    return NextResponse.json(
      { error: "이 주문과 맞는 줄을 찾지 못했습니다. 다른 주문의 발주서인지 확인해주세요." },
      { status: 400 },
    )
  }

  return NextResponse.json({
    changes,
    unmatched: [...new Set(unmatched)],
    // 파일에 아예 없던 항목. 창고가 줄을 지웠을 수 있어 그대로 두고 알린다.
    missing: order.items
      .filter((i) => !seen.has(i.id))
      .map((i) => `${i.variant?.product?.code || i.productName} / ${i.colorName} / ${i.sizeName}`),
  })
}

export const POST = apiRoute(POST_impl, { retry: false })
