import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiRoute } from "@/lib/api-route"

async function GET_impl() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const setting = await prisma.paymentSetting.findFirst({ select: { notificationEmail: true } })
  return NextResponse.json({ notificationEmail: setting?.notificationEmail ?? "" })
}

// notificationEmail 만 갱신한다. 다른 결제 필드는 건드리지 않는다.
async function PUT_impl(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { notificationEmail } = await request.json().catch(() => ({}))
  const value = typeof notificationEmail === "string" ? notificationEmail.trim() || null : null

  const existing = await prisma.paymentSetting.findFirst({ select: { id: true } })
  if (existing) {
    await prisma.paymentSetting.update({ where: { id: existing.id }, data: { notificationEmail: value } })
  } else {
    await prisma.paymentSetting.create({ data: { notificationEmail: value } })
  }
  return NextResponse.json({ notificationEmail: value ?? "" })
}

export const GET = apiRoute(GET_impl, { retry: true })
export const PUT = apiRoute(PUT_impl, { retry: false })
