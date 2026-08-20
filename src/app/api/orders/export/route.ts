import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"
import { apiRoute } from "@/lib/api-route"
import { ALL_SIZES } from "@/lib/product-sizes"

const statusLabels: Record<string, string> = {
  ORDER_PLACED: "주문접수",
  INVOICE_SENT: "인보이스 발행",
  PAYMENT_CONFIRMED: "입금확인",
  SHIPPED: "출하완료",
  CANCELLED: "취소됨",
}

const paymentLabels: Record<string, string> = {
  PENDING: "입금대기",
  PAID: "결제완료",
  FAILED: "실패",
  REFUNDED: "환불",
}

const paymentMethodLabels: Record<string, string> = {
  CARD: "카드",
  BANK_TRANSFER: "계좌이체",
  VIRTUAL_ACCOUNT: "가상계좌",
}

async function GET_impl(request: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const idsParam = request.nextUrl.searchParams.get("ids")
  // 사이즈를 세로(행)로 펼칠지 가로(열)로 펼칠지 고른다.
  // 가로는 생산 발주서나 창고 피킹에 그대로 쓸 수 있다.
  const layout = request.nextUrl.searchParams.get("layout") === "grid" ? "grid" : "rows"
  const where = idsParam
    ? { id: { in: idsParam.split(",").filter(Boolean) } }
    : {}

  const orders = await prisma.order.findMany({
    where,
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          businessName: true,
          businessNumber: true,
        },
      },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  })

  // 두 형식이 공유하는 주문 정보
  const orderInfo = (order: (typeof orders)[number]) => ({
    주문번호: order.orderNumber,
    주문일시: new Date(order.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
    주문상태: statusLabels[order.status] || order.status,
    결제상태: paymentLabels[order.paymentStatus] || order.paymentStatus,
    결제수단: order.paymentMethod
      ? paymentMethodLabels[order.paymentMethod] || order.paymentMethod
      : "-",
    주문자명: order.user?.name ?? order.deletedUserName ?? "-",
    이메일: order.user?.email ?? order.deletedUserEmail ?? "-",
    연락처: order.user?.phone || "-",
    상호명: order.user?.businessName || "-",
    사업자번호: order.user?.businessNumber || "-",
    수령인: order.recipientName || "-",
    수령인연락처: order.recipientPhone || "-",
    배송주소: order.shippingAddress || "-",
    배송메모: order.shippingMemo || "-",
  })

  // 주문 아이템 단위로 한 행씩 (대량 주문 상세 포함)
  const rowsLayout = orders.flatMap((order) =>
    order.items.map((item) => ({
      주문번호: order.orderNumber,
      주문일시: new Date(order.createdAt).toLocaleString("ko-KR", {
        timeZone: "Asia/Seoul",
      }),
      주문상태: statusLabels[order.status] || order.status,
      결제상태: paymentLabels[order.paymentStatus] || order.paymentStatus,
      결제수단: order.paymentMethod
        ? paymentMethodLabels[order.paymentMethod] || order.paymentMethod
        : "-",
      주문자명: order.user?.name ?? order.deletedUserName ?? "-",
      이메일: order.user?.email ?? order.deletedUserEmail ?? "-",
      연락처: order.user?.phone || "-",
      상호명: order.user?.businessName || "-",
      사업자번호: order.user?.businessNumber || "-",
      수령인: order.recipientName || "-",
      수령인연락처: order.recipientPhone || "-",
      배송주소: order.shippingAddress || "-",
      배송메모: order.shippingMemo || "-",
      상품명: item.productName,
      컬러: item.colorName,
      사이즈: item.sizeName,
      수량: item.quantity,
      단가: item.price,
      소계: item.price * item.quantity,
      주문총액: order.totalAmount,
    })),
  )

  /**
   * 가로 형식: 사이즈를 열로 펼친다.
   * 주문마다 사이즈 구성이 다르므로, 등장한 사이즈를 모두 모아 열을 만들고
   * 없는 칸은 비워 둔다. 사이즈 순서는 옷 치수 순서를 따른다.
   */
  // 열 순서를 직접 준다. "85", "90" 같은 숫자꼴 키를 객체에 담으면
  // 자바스크립트가 그 키들을 앞으로 끌어올려 주문번호보다 먼저 나온다.
  let gridHeader: string[] = []

  function buildGrid() {
    const seen = new Set<string>()
    for (const o of orders) for (const it of o.items) seen.add(it.sizeName)
    const sizeCols = [...seen].sort((a, b) => {
      const ai = ALL_SIZES.indexOf(a)
      const bi = ALL_SIZES.indexOf(b)
      if (ai === -1 && bi === -1) return a.localeCompare(b)
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })

    gridHeader = [
      ...Object.keys(orderInfo(orders[0])),
      "상품명",
      "컬러",
      ...sizeCols,
      "수량합계",
      "단가",
      "금액",
    ]

    const out: Record<string, unknown>[] = []
    for (const order of orders) {
      // 상품 + 컬러 단위로 묶고 사이즈를 열에 담는다
      const groups = new Map<string, Record<string, unknown>>()
      for (const item of order.items) {
        const key = `${item.productName}|${item.colorName}`
        if (!groups.has(key)) {
          groups.set(key, {
            ...orderInfo(order),
            상품명: item.productName,
            컬러: item.colorName,
            ...Object.fromEntries(sizeCols.map((c) => [c, ""])),
            수량합계: 0,
            단가: item.price,
            금액: 0,
          })
        }
        const g = groups.get(key)!
        g[item.sizeName] = ((g[item.sizeName] as number) || 0) + item.quantity
        g.수량합계 = (g.수량합계 as number) + item.quantity
        g.금액 = (g.금액 as number) + item.price * item.quantity
      }
      out.push(...groups.values())
    }
    return out
  }

  const rows = layout === "grid" ? buildGrid() : rowsLayout
  const header = layout === "grid" ? gridHeader : Object.keys(rows[0] || {})

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows, { header })

  // 컬럼 너비 자동 조정
  const colWidths = header.map((key) => {
    const maxLen = Math.max(
      key.length * 2,
      ...rows.map((r) => String((r as Record<string, unknown>)[key] ?? "").length),
    )
    return { wch: Math.min(maxLen + 2, 40) }
  })
  ws["!cols"] = colWidths

  XLSX.utils.book_append_sheet(wb, ws, layout === "grid" ? "주문목록(사이즈 가로)" : "주문목록")

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })

  const today = new Date()
    .toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })
    .replace(/\. /g, "")
    .replace(".", "")
  const filename = `주문목록_${today}.xlsx`

  return new NextResponse(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}

export const GET = apiRoute(GET_impl, { retry: true })
