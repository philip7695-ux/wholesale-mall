import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiRoute } from "@/lib/api-route"

// 사이드바 알림 배지용 카운트. 관리자가 아직 손대지 않은 것들.
async function GET_impl() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const [newOrders, pendingMembers] = await Promise.all([
    prisma.order.count({ where: { status: "ORDER_PLACED" } }),
    prisma.user.count({ where: { role: "BUYER", approvalStatus: "PENDING" } }),
  ])
  return NextResponse.json({ newOrders, pendingMembers })
}

export const GET = apiRoute(GET_impl, { retry: true })
