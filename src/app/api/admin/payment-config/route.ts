import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const configs = await prisma.paymentConfig.findMany({
      orderBy: { method: "asc" },
    })
    return NextResponse.json(configs)
  } catch {
    return NextResponse.json([])
  }
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { method, enabled, accountName, accountInfo, bankName, qrCodeUrl, memo } = body as {
    method: string
    enabled: boolean
    accountName: string
    accountInfo: string
    bankName: string
    qrCodeUrl: string
    memo: string
  }

  if (!method) {
    return NextResponse.json({ error: "method is required" }, { status: 400 })
  }

  try {
    const config = await prisma.paymentConfig.upsert({
      where: { method },
      update: {
        enabled,
        accountName: accountName || "",
        accountInfo: accountInfo || "",
        bankName: bankName || "",
        qrCodeUrl: qrCodeUrl || "",
        memo: memo || "",
      },
      create: {
        method,
        enabled,
        accountName: accountName || "",
        accountInfo: accountInfo || "",
        bankName: bankName || "",
        qrCodeUrl: qrCodeUrl || "",
        memo: memo || "",
      },
    })
    return NextResponse.json(config)
  } catch (error) {
    console.error("[PUT /api/admin/payment-config] error:", error)
    return NextResponse.json({ error: "Save failed" }, { status: 500 })
  }
}
