import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { withDbRetry } from "@/lib/db-retry"
import { apiRoute } from "@/lib/api-route"
import { getSeasonRates, getSpecialOfferRate } from "@/lib/pricing.server"
import { getGradeDiscount } from "@/lib/grade.server"
import { buyerPrice, seasonRateFor } from "@/lib/pricing"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const items = await withDbRetry(() =>
      prisma.cartItem.findMany({
        where: { userId: session.user.id },
        include: {
          variant: {
            include: {
              // 장바구니를 오더시트처럼 보여주려면 담지 않은 사이즈도 알아야 한다.
              // 상품의 전체 사이즈·변형을 함께 내려보낸다.
              product: {
                include: {
                  colors: { orderBy: { sortOrder: "asc" } },
                  sizes: { orderBy: { sortOrder: "asc" } },
                  variants: { select: { id: true, colorId: true, sizeId: true, price: true, stock: true } },
                },
              },
              color: true,
              size: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    )
    // 상품에 저장된 값은 정상가다. 화면이 다시 계산하면 주문 금액과
    // 어긋나므로, 여기서 도매가로 바꿔 내려준다.
    const [seasonRates, gradeRate, specialOfferRate] = await Promise.all([
      getSeasonRates(),
      getGradeDiscount(session.user.buyerGrade || "BRONZE").catch(() => 0),
      getSpecialOfferRate(),
    ])
    // 담지 않은 변형도 같은 규칙으로 값을 매겨야 빈 칸에 수량을 넣었을 때
    // 가격이 달라지지 않는다.
    const priceOf = (product: any, raw: number) =>
      buyerPrice(
        raw,
        seasonRateFor(product.code, seasonRates),
        gradeRate,
        product.specialOffer ? specialOfferRate : 0,
      )

    const priced = items.map((item: any) => ({
      ...item,
      variant: {
        ...item.variant,
        retailPrice: item.variant.price,
        price: priceOf(item.variant.product, item.variant.price),
        product: {
          ...item.variant.product,
          variants: item.variant.product.variants.map((v: any) => ({
            ...v,
            price: priceOf(item.variant.product, v.price),
          })),
        },
      },
    }))
    return NextResponse.json(priced)
  } catch (err: any) {
    // 예외를 그대로 두면 본문 없는 500 이 나가고 클라이언트의 res.json() 이
    // "Unexpected end of JSON input" 으로 터진다. 항상 JSON 으로 응답한다.
    console.error("[GET /api/cart] DB error:", err)
    return NextResponse.json(
      { error: "장바구니를 불러오지 못했습니다. 잠시 후 다시 시도해주세요." },
      { status: 503 },
    )
  }
}

async function POST_impl(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 승인된 회원만 장바구니 담기 가능
  if (session.user.approvalStatus !== "APPROVED") {
    return NextResponse.json({ error: "회원 승인 후 이용 가능합니다." }, { status: 403 })
  }

  const body = await request.json()
  const items = body?.items
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  for (const item of items as { variantId: string; quantity: number }[]) {
    // 입력 검증: variantId 문자열 + quantity 양의 정수
    if (
      !item ||
      typeof item.variantId !== "string" ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      return NextResponse.json({ error: "잘못된 상품 정보입니다." }, { status: 400 })
    }

    // variant 실재 여부 확인 (FK 오류로 인한 500 방지)
    const variant = await prisma.productVariant.findUnique({
      where: { id: item.variantId },
      select: { id: true },
    })
    if (!variant) {
      return NextResponse.json({ error: "존재하지 않는 상품입니다." }, { status: 404 })
    }

    // 동시 요청 시 unique 충돌 없이 누적 (upsert)
    await prisma.cartItem.upsert({
      where: {
        userId_variantId: {
          userId: session.user.id,
          variantId: item.variantId,
        },
      },
      update: { quantity: { increment: item.quantity } },
      create: {
        userId: session.user.id,
        variantId: item.variantId,
        quantity: item.quantity,
      },
    })
  }

  return NextResponse.json({ message: "장바구니에 추가되었습니다." })
}

async function PUT_impl(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { cartItemId, quantity } = await request.json()

  if (typeof cartItemId !== "string" || !Number.isInteger(quantity)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  // 소유권 검증: 본인 장바구니 항목만 수정/삭제 (IDOR 방지)
  if (quantity <= 0) {
    const res = await prisma.cartItem.deleteMany({
      where: { id: cartItemId, userId: session.user.id },
    })
    if (res.count === 0) {
      return NextResponse.json({ error: "항목을 찾을 수 없습니다." }, { status: 404 })
    }
  } else {
    const res = await prisma.cartItem.updateMany({
      where: { id: cartItemId, userId: session.user.id },
      data: { quantity },
    })
    if (res.count === 0) {
      return NextResponse.json({ error: "항목을 찾을 수 없습니다." }, { status: 404 })
    }
  }

  return NextResponse.json({ message: "수량이 변경되었습니다." })
}

async function DELETE_impl(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { cartItemId } = await request.json()
  if (typeof cartItemId !== "string") {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 })
  }

  // 소유권 검증: 본인 항목만 삭제 (IDOR 방지)
  const res = await prisma.cartItem.deleteMany({
    where: { id: cartItemId, userId: session.user.id },
  })
  if (res.count === 0) {
    return NextResponse.json({ error: "항목을 찾을 수 없습니다." }, { status: 404 })
  }

  return NextResponse.json({ message: "삭제되었습니다." })
}

export const POST = apiRoute(POST_impl, { retry: false })
export const PUT = apiRoute(PUT_impl, { retry: false })
export const DELETE = apiRoute(DELETE_impl, { retry: false })
