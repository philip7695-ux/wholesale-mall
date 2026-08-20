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
