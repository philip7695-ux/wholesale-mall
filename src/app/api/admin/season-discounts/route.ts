import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiRoute } from "@/lib/api-route"

async function GET_impl() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const rows = await prisma.seasonDiscount.findMany({ orderBy: { seasonKey: "desc" } })
  return NextResponse.json(rows)
}

async function PUT_impl(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { seasonKey, rate, brand: brandRaw } = await request.json()
  const brand = typeof brandRaw === "string" ? brandRaw.trim() : ""

  if (typeof seasonKey !== "string" || !/^[0-9][1-9]$/.test(seasonKey)) {
    return NextResponse.json({ error: "시즌 값이 올바르지 않습니다." }, { status: 400 })
  }
  // 할인율이 1 을 넘으면 가격이 음수가 된다. 0~95% 로 제한한다.
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 || rate > 0.95) {
    return NextResponse.json({ error: "할인율은 0~95% 사이여야 합니다." }, { status: 400 })
  }

  const saved = await prisma.seasonDiscount.upsert({
    where: { brand_seasonKey: { brand, seasonKey } },
    update: { rate },
    create: { brand, seasonKey, rate },
  })
  return NextResponse.json(saved)
}

export const GET = apiRoute(GET_impl, { retry: true })
export const PUT = apiRoute(PUT_impl, { retry: false })
