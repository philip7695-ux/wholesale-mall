import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"

export async function POST(request: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { email, password, name, phone, businessName, businessNumber, businessAddress, role, approvalStatus } = body

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "이메일, 비밀번호, 이름은 필수입니다." },
        { status: 400 },
      )
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: "이미 등록된 이메일입니다." },
        { status: 400 },
      )
    }

    const hashedPassword = await hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone: phone || null,
        businessName: businessName || null,
        businessNumber: businessNumber || null,
        businessAddress: businessAddress || null,
        role: role || "BUYER",
        approvalStatus: approvalStatus || "APPROVED",
      },
    })

    return NextResponse.json(
      { message: "회원이 등록되었습니다.", userId: user.id },
      { status: 201 },
    )
  } catch {
    return NextResponse.json(
      { error: "회원 등록 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
