import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiRoute } from "@/lib/api-route"
import { SUPPORTED_CURRENCIES } from "@/lib/currency"

async function GET_impl(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      businessName: true,
      businessNumber: true,
      businessAddress: true,
      country: true,
      adminNote: true,
      approvalStatus: true,
      buyerGrade: true,
      tradeType: true,
      currency: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(user)
}

async function PUT_impl(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  const allowedFields = [
    "approvalStatus", "buyerGrade", "role",
    "name", "phone", "businessName", "businessNumber", "businessAddress",
    "country", "adminNote",
    "tradeType", "currency",
  ] as const

  // 자기 자신의 역할은 변경 불가
  if (body.role && id === session.user.id) {
    return NextResponse.json({ error: "자기 자신의 역할은 변경할 수 없습니다." }, { status: 400 })
  }

  // role 값 검증
  if (body.role && !["ADMIN", "BUYER"].includes(body.role)) {
    return NextResponse.json({ error: "유효하지 않은 역할입니다." }, { status: 400 })
  }

  if (body.tradeType !== undefined && !["DOMESTIC", "EXPORT"].includes(body.tradeType)) {
    return NextResponse.json({ error: "유효하지 않은 거래 유형입니다." }, { status: 400 })
  }

  // 통화는 지정하지 않으면(null) 접속 언어를 따라간다
  if (body.currency !== undefined && body.currency !== null &&
      !SUPPORTED_CURRENCIES.includes(body.currency)) {
    return NextResponse.json({ error: "지원하지 않는 통화입니다." }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      data[field] = body[field]
    }
  }

  // 국내 거래는 통화가 KRW 로 고정되므로 지정값을 남겨두지 않는다
  if (data.tradeType === "DOMESTIC") data.currency = null

  const user = await prisma.user.update({
    where: { id },
    data,
  })

  revalidatePath("/[locale]/admin/members", "page")

  return NextResponse.json(user)
}

async function DELETE_impl(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // 자기 자신은 삭제 불가
  if (id === session.user.id) {
    return NextResponse.json({ error: "자기 자신은 삭제할 수 없습니다." }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id },
  })

  if (!user) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 })
  }

  // 주문 내역은 보존하고 회원만 삭제
  await prisma.$transaction(async (tx) => {
    // 주문에 삭제된 회원 정보 기록 (나중에 조회 가능하도록)
    await tx.order.updateMany({
      where: { userId: id },
      data: {
        deletedUserName: user.name,
        deletedUserEmail: user.email,
      },
    })
    // 장바구니 삭제
    await tx.cartItem.deleteMany({ where: { userId: id } })
    // 회원 삭제 (onDelete: SetNull로 주문의 userId는 자동으로 null 처리)
    await tx.user.delete({ where: { id } })
  })

  revalidatePath("/[locale]/admin/members", "page")

  return NextResponse.json({ message: "회원이 삭제되었습니다." })
}

export const GET = apiRoute(GET_impl, { retry: true })
export const PUT = apiRoute(PUT_impl, { retry: false })
export const DELETE = apiRoute(DELETE_impl, { retry: false })
