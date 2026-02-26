import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, name, phone, businessName, businessNumber, businessAddress } = body

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
        phone,
        businessName,
        businessNumber,
        businessAddress,
        role: "BUYER",
        approvalStatus: "PENDING",
      },
    })

    return NextResponse.json(
      { message: "회원가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다.", userId: user.id },
      { status: 201 },
    )
  } catch {
    return NextResponse.json(
      { error: "회원가입 중 오류가 발생했습니다." },
      { status: 500 },
    )
  }
}
