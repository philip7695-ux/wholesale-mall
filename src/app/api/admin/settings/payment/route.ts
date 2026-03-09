import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const setting = await prisma.paymentSetting.findFirst()
  return NextResponse.json(setting)
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { notificationEmail, bankName, accountNumber, accountHolder, bankNote, alipayQrImage, alipayNote, wechatQrImage, wechatNote } =
      await request.json()

    const existing = await prisma.paymentSetting.findFirst()

    const data = {
      notificationEmail: notificationEmail || null,
      bankName: bankName || null,
      accountNumber: accountNumber || null,
      accountHolder: accountHolder || null,
      bankNote: bankNote || null,
      alipayQrImage: alipayQrImage || null,
      alipayNote: alipayNote || null,
      wechatQrImage: wechatQrImage || null,
      wechatNote: wechatNote || null,
    }

    const result = existing
      ? await prisma.paymentSetting.update({ where: { id: existing.id }, data })
      : await prisma.paymentSetting.create({ data })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Payment setting update error:", error)
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }
}
