import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const config = await prisma.storeConfig.findUnique({ where: { id: "default" } })
    return NextResponse.json(config || {
      companyName: "",
      address: "",
      phone: "",
      email: "",
      footerMessage: "Thank you for your business!",
      footerTerms: "Payment is due within 7 days of invoice date.",
    })
  } catch {
    return NextResponse.json({})
  }
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()

    // 설정이 여러 화면으로 나뉘어 있어 각 화면은 자기 필드만 보낸다.
    // 받지 않은 필드를 빈 값으로 덮으면 다른 화면의 설정이 지워진다.
    const FIELDS = [
      "companyName",
      "address",
      "phone",
      "email",
      "footerMessage",
      "footerTerms",
      "loginHeroUrl",
      "loginTagline",
      "loginTitle",
    ] as const

    const patch: Record<string, string> = {}
    for (const f of FIELDS) {
      if (body[f] !== undefined) patch[f] = String(body[f] ?? "")
    }

    const config = await prisma.storeConfig.upsert({
      where: { id: "default" },
      update: patch,
      create: { id: "default", ...patch },
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error("[PUT /api/admin/store-config] error:", error)
    return NextResponse.json({ error: "Save failed" }, { status: 500 })
  }
}
