import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as XLSX from "xlsx"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          businessName: true,
        },
      },
      items: {
        include: {
          variant: {
            include: {
              product: { select: { code: true } },
            },
          },
        },
      },
    },
  })

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  // 상품명으로 Product.code 조회 (variantId가 null인 경우 대비)
  const productNames = [...new Set(order.items.map((i) => i.productName))]
  const products = await prisma.product.findMany({
    where: { name: { in: productNames } },
    select: { name: true, code: true },
  })
  const productCodeMap = new Map(products.map((p) => [p.name, p.code]))

  // 모든 사이즈 수집 (출현 순서 유지)
  const sizeSet = new Set<string>()
  for (const item of order.items) {
    sizeSet.add(item.sizeName)
  }
  const allSizes = Array.from(sizeSet)

  // 상품코드 + 컬러 기준으로 그룹핑
  const groupMap = new Map<string, {
    productCode: string
    productName: string
    colorName: string
    unitPrice: number
    sizeQty: Record<string, number>
  }>()

  for (const item of order.items) {
    const productCode = item.variant?.product?.code || productCodeMap.get(item.productName) || "-"
    const key = `${productCode}__${item.colorName}`

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        productCode,
        productName: item.productName,
        colorName: item.colorName,
        unitPrice: item.price,
        sizeQty: {},
      })
    }

    const group = groupMap.get(key)!
    group.sizeQty[item.sizeName] = (group.sizeQty[item.sizeName] || 0) + item.quantity
  }

  // 피벗 테이블 rows 생성
  const rows: Record<string, string | number>[] = []
  let no = 0
  for (const group of groupMap.values()) {
    no++
    const row: Record<string, string | number> = {
      "No.": no,
      "상품코드": group.productCode,
      "상품명": group.productName,
      "컬러": group.colorName,
    }

    let rowTotal = 0
    for (const size of allSizes) {
      const qty = group.sizeQty[size] || 0
      row[size] = qty || ""
      rowTotal += qty
    }

    row["합계"] = rowTotal
    row["단가"] = group.unitPrice
    row["소계"] = group.unitPrice * rowTotal

    rows.push(row)
  }

  const wb = XLSX.utils.book_new()

  // 주문 요약 시트
  const summaryData = [
    ["패킹리스트 / Packing List"],
    [],
    ["주문번호", order.orderNumber],
    ["인보이스 번호", order.invoiceNumber || "-"],
    ["주문일시", new Date(order.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })],
    [],
    ["주문자", order.user.name],
    ["상호", order.user.businessName || "-"],
    ["연락처", order.user.phone || "-"],
    ["이메일", order.user.email],
    [],
    ["수령인", order.recipientName || "-"],
    ["연락처", order.recipientPhone || "-"],
    ["배송주소", order.shippingAddress || "-"],
    ["배송메모", order.shippingMemo || "-"],
    [],
    ["총 금액", order.totalAmount],
    ["총 수량", order.items.reduce((sum, item) => sum + item.quantity, 0)],
  ]
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
  summaryWs["!cols"] = [{ wch: 16 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, summaryWs, "주문요약")

  // 상품 상세 시트 (사이즈 가로 피벗)
  const itemsWs = XLSX.utils.json_to_sheet(rows)
  const headers = Object.keys(rows[0] || {})
  itemsWs["!cols"] = headers.map((key) => {
    if (["No."].includes(key)) return { wch: 5 }
    if (["상품코드"].includes(key)) return { wch: 12 }
    if (["상품명"].includes(key)) return { wch: 25 }
    if (["컬러"].includes(key)) return { wch: 12 }
    if (["단가", "소계"].includes(key)) return { wch: 12 }
    if (["합계"].includes(key)) return { wch: 8 }
    return { wch: 8 } // 사이즈 컬럼
  })
  XLSX.utils.book_append_sheet(wb, itemsWs, "상품목록")

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  const filename = `패킹리스트_${order.orderNumber}.xlsx`

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
