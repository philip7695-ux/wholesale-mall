import { NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getApiTranslations } from "@/lib/api-i18n"

export async function POST(request: Request) {
  const t = await getApiTranslations(request, "api")

  try {
    const body = await request.json()
    const { email, password, name, phone, businessName, businessNumber, businessAddress } = body

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: t("requiredFields") },
        { status: 400 },
      )
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: t("emailExists") },
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
      { message: t("registerSuccess"), userId: user.id },
      { status: 201 },
    )
  } catch {
    return NextResponse.json(
      { error: t("registerError") },
      { status: 500 },
    )
  }
}
