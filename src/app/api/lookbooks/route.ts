import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiRoute } from "@/lib/api-route"

// 로그인한 회원만 활성 룩북 목록을 본다. 도매 자료라 비회원엔 열지 않는다.
async function GET_impl() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const items = await prisma.lookbook.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: { id: true, title: true, url: true, format: true, bytes: true, createdAt: true },
  })
  return NextResponse.json(items)
}

export const GET = apiRoute(GET_impl, { retry: true })
