import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const setting = await prisma.paymentSetting.findFirst({
    select: {
      bankName: true,
      accountNumber: true,
      accountHolder: true,
      bankNote: true,
      alipayQrImage: true,
      alipayNote: true,
      wechatQrImage: true,
      wechatNote: true,
    },
  })

  return NextResponse.json(setting)
}
