import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
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
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { companyName, address, phone, email, footerMessage, footerTerms } = await request.json()

    const config = await prisma.storeConfig.upsert({
      where: { id: "default" },
      update: {
        companyName: companyName || "",
        address: address || "",
        phone: phone || "",
        email: email || "",
        footerMessage: footerMessage || "",
        footerTerms: footerTerms || "",
      },
      create: {
        id: "default",
        companyName: companyName || "",
        address: address || "",
        phone: phone || "",
        email: email || "",
        footerMessage: footerMessage || "",
        footerTerms: footerTerms || "",
      },
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error("[PUT /api/admin/store-config] error:", error)
    return NextResponse.json({ error: "Save failed" }, { status: 500 })
  }
}
