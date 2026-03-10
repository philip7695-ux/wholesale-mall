import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const configs = await prisma.paymentConfig.findMany({
      where: { enabled: true },
      select: {
        method: true,
        accountName: true,
        accountInfo: true,
        bankName: true,
        qrCodeUrl: true,
        memo: true,
      },
      orderBy: { method: "asc" },
    })
    return NextResponse.json(configs)
  } catch {
    return NextResponse.json([])
  }
}
