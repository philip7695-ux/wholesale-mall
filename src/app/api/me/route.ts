import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hash, compare } from "bcryptjs"
import { getApiTranslations } from "@/lib/api-i18n"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      businessName: true,
      businessNumber: true,
      businessAddress: true,
    },
  })

  return NextResponse.json(user)
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { name, phone, businessName, businessNumber, businessAddress, currentPassword, newPassword } = body

  const t = await getApiTranslations(request, "api")

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: t("currentPasswordRequired") }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } })
    if (!user) {
      return NextResponse.json({ error: t("userNotFound") }, { status: 404 })
    }

    const isValid = await compare(currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json({ error: t("currentPasswordWrong") }, { status: 400 })
    }

    const hashedPassword = await hash(newPassword, 12)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    })
  }

  // 프로필 정보 업데이트
  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name,
      phone: phone || null,
      businessName: businessName || null,
      businessNumber: businessNumber || null,
      businessAddress: businessAddress || null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      businessName: true,
      businessNumber: true,
      businessAddress: true,
    },
  })

  return NextResponse.json(updated)
}
