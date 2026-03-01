import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getWiseBalances, isWiseConfigured } from "@/lib/wise"

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isWiseConfigured()) {
    return NextResponse.json(
      { error: "Wise API not configured" },
      { status: 400 }
    )
  }

  const config = await prisma.wiseConfig.findFirst()
  if (!config) {
    return NextResponse.json(
      { error: "Wise profile not configured" },
      { status: 400 }
    )
  }

  try {
    const balances = await getWiseBalances(config.profileId)
    return NextResponse.json({ balances })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch balances" },
      { status: 500 }
    )
  }
}
