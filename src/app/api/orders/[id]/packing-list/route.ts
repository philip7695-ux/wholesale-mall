import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiRoute } from "@/lib/api-route"
import { sortSizeNames } from "@/lib/product-sizes"
import { renderSheet } from "@/lib/sheet-style"

async function GET_impl(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
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

  // 모든 사이즈 수집. 인보이스에서 사이즈를 뺐으므로 사이즈 배분을
  // 확인할 곳은 여기뿐이다. 출현 순서가 아니라 치수 순서로 늘어놓는다.
  const sizeSet = new Set<string>()
  for (const item of order.items) {
    // 취소된 항목만 있는 치수는 열을 만들지 않는다. 빈 칸만 남는다.
    if (item.quantity === 0) continue
    sizeSet.add(item.sizeName)
  }
  const allSizes = sortSizeNames(Array.from(sizeSet))

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

  // 열 순서를 직접 정한다. "85", "90" 같은 숫자꼴 키를 객체에 담으면
  // 자바스크립트가 그 키들을 앞으로 끌어올려 상품코드보다 먼저 나온다.
  const headers = ["상품코드", "상품명", "컬러", ...allSizes, "합계", "단가", "소계"]

  // 피벗 테이블 rows 생성
  const rows: Record<string, string | number>[] = []
  for (const group of groupMap.values()) {
    const row: Record<string, string | number> = {
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

    // 패킹리스트는 박스에 실제로 들어가는 것을 적는 문서다. 통째로
    // 취소된 품번·컬러는 실리지 않는다. (창고에 취소를 알리는 자리는
    // 발주서다. 거기서는 붉게 그어 명시한다.)
    if (rowTotal === 0) continue

    row["합계"] = rowTotal
    row["단가"] = group.unitPrice
    row["소계"] = group.unitPrice * rowTotal

    rows.push(row)
  }

  const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0)

  const buf = await renderSheet({
    summary: {
      sheetName: "주문요약",
      title: "패킹리스트 / Packing List",
      rows: [
        ["주문번호", order.orderNumber],
        ["인보이스 번호", order.invoiceNumber || "-"],
        ["주문일시", new Date(order.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })],
        ["", ""],
        ["주문자", order.user?.name ?? order.deletedUserName ?? "-"],
        ["상호", order.user?.businessName || "-"],
        ["연락처", order.user?.phone || "-"],
        ["이메일", order.user?.email ?? order.deletedUserEmail ?? "-"],
        ["", ""],
        ["수령인", order.recipientName || "-"],
        ["연락처", order.recipientPhone || "-"],
        ["배송주소", order.shippingAddress || "-"],
        ["배송메모", order.shippingMemo || "-"],
        ["", ""],
        ["총 금액", order.totalAmount],
        ["총 수량", totalQty],
      ],
    },
    sheetName: "상품목록",
    title: `패킹리스트  ${order.orderNumber}`,
    subtitle: [
      `수령인: ${order.recipientName || "-"}`,
      `총 ${rows.length}개 스타일`,
      `총 ${totalQty}장`,
    ].join("      "),
    notice: "사이즈별 수량은 아래 표에서 확인하세요.",
    header: headers,
    rows,
  })

  const filename = `패킹리스트_${order.orderNumber}.xlsx`

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}

export const GET = apiRoute(GET_impl, { retry: true })
