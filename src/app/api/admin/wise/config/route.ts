import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isWiseConfigured } from "@/lib/wise"

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const config = await prisma.wiseConfig.findFirst()

  return NextResponse.json({
    profileId: config?.profileId ?? "",
    apiTokenConfigured: isWiseConfigured(),
  })
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { profileId } = body as { profileId?: string }

  if (!profileId || typeof profileId !== "string") {
    return NextResponse.json(
      { error: "profileId is required" },
      { status: 400 }
    )
  }

  const existing = await prisma.wiseConfig.findFirst()

  if (existing) {
    await prisma.wiseConfig.update({
      where: { id: existing.id },
      data: { profileId: profileId.trim() },
    })
  } else {
    await prisma.wiseConfig.create({
      data: { profileId: profileId.trim() },
    })
  }

  return NextResponse.json({ ok: true })
}
