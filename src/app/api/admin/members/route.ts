import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"
import { getApiTranslations } from "@/lib/api-i18n"

export async function POST(request: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const t = await getApiTranslations(request, "api")

  try {
    const body = await request.json()
    const { email, password, name, phone, businessName, businessNumber, businessAddress, role, approvalStatus } = body

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: t("memberRequiredFields") },
        { status: 400 },
      )
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: t("memberEmailExists") },
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
      { message: t("memberRegistered"), userId: user.id },
      { status: 201 },
    )
  } catch {
    return NextResponse.json(
      { error: t("memberRegisterError") },
      { status: 500 },
    )
  }
}
