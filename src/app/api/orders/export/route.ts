import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

const statusLabels: Record<string, string> = {
  PENDING: "주문접수",
  CONFIRMED: "주문확인",
  SHIPPING: "배송중",
  DELIVERED: "배송완료",
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

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orders = await prisma.order.findMany({
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

  // 주문 아이템 단위로 한 행씩 (대량 주문 상세 포함)
  const rows = orders.flatMap((order) =>
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
      주문자명: order.user.name,
      이메일: order.user.email,
      연락처: order.user.phone || "-",
      상호명: order.user.businessName || "-",
      사업자번호: order.user.businessNumber || "-",
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

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // 컬럼 너비 자동 조정
  const colWidths = Object.keys(rows[0] || {}).map((key) => {
    const maxLen = Math.max(
      key.length * 2,
      ...rows.map((r) => String((r as Record<string, unknown>)[key] ?? "").length),
    )
    return { wch: Math.min(maxLen + 2, 40) }
  })
  ws["!cols"] = colWidths

  XLSX.utils.book_append_sheet(wb, ws, "주문목록")

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
