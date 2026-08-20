import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiRoute } from "@/lib/api-route"

/**
 * 여러 상품을 한 번에 노출 전환하거나 삭제한다.
 *
 * 목록에서 하나씩 누르면 수백 개를 정리할 때 감당이 안 된다.
 *
 * 삭제하면 색상·사이즈·변형이 함께 지워지고 장바구니에서도 빠진다.
 * 주문 이력은 남는다(OrderItem 이 상품명·색상·사이즈를 스냅샷으로
 * 갖고 있고 연결만 끊긴다). 다만 되돌릴 수 없으므로 주문된 적 있는
 * 상품이 섞여 있으면 몇 건인지 알려준다.
 */

const MAX = 500

async function POST_impl(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { ids, action, confirmOrdered } = await request.json()

  if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "string")) {
    return NextResponse.json({ error: "상품을 선택해주세요." }, { status: 400 })
  }
  if (ids.length > MAX) {
    return NextResponse.json(
      { error: `한 번에 ${MAX}개까지만 처리할 수 있습니다.` },
      { status: 400 },
    )
  }
  if (!["activate", "deactivate", "delete", "special", "unspecial"].includes(action)) {
    return NextResponse.json({ error: "알 수 없는 작업입니다." }, { status: 400 })
  }

  if (action === "special" || action === "unspecial") {
    const res = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { specialOffer: action === "special" },
    })
    return NextResponse.json({ count: res.count })
  }

  if (action !== "delete") {
    const res = await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { isActive: action === "activate" },
    })
    return NextResponse.json({ count: res.count })
  }

  // 주문된 적 있는 상품은 지우면 이력의 연결이 끊긴다. 먼저 알리고 확인받는다.
  const ordered = await prisma.product.count({
    where: { id: { in: ids }, variants: { some: { orderItems: { some: {} } } } },
  })
  if (ordered > 0 && !confirmOrdered) {
    return NextResponse.json({ needsConfirm: true, ordered }, { status: 409 })
  }

  const res = await prisma.product.deleteMany({ where: { id: { in: ids } } })
  return NextResponse.json({ count: res.count })
}

export const POST = apiRoute(POST_impl, { retry: false })
