import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rates = await prisma.exchangeRate.findMany({
    orderBy: { currency: "asc" },
  })

  return NextResponse.json(rates)
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { currency, rate } = await request.json()

    if (!currency || typeof rate !== "number" || rate <= 0) {
      return NextResponse.json({ error: "Invalid currency or rate" }, { status: 400 })
    }

    const result = await prisma.exchangeRate.upsert({
      where: { currency },
      update: { rate },
      create: { currency, rate },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("Exchange rate update error:", error)
    return NextResponse.json({ error: "Failed to update exchange rate" }, { status: 500 })
  }
}
