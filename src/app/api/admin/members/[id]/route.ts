import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const { approvalStatus, buyerGrade } = await request.json()

  const data: Record<string, string> = {}
  if (approvalStatus) data.approvalStatus = approvalStatus
  if (buyerGrade) data.buyerGrade = buyerGrade

  const user = await prisma.user.update({
    where: { id },
    data,
  })

  return NextResponse.json(user)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  // 자기 자신은 삭제 불가
  if (id === session.user.id) {
    return NextResponse.json({ error: "자기 자신은 삭제할 수 없습니다." }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: { _count: { select: { orders: true } } },
  })

  if (!user) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 })
  }

  // 주문이 있는 회원은 장바구니만 삭제 후 회원 삭제
  await prisma.cartItem.deleteMany({ where: { userId: id } })
  await prisma.user.delete({ where: { id } })

  return NextResponse.json({ message: "회원이 삭제되었습니다." })
}
