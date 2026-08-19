import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { apiRoute } from "@/lib/api-route"

async function GET_impl() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  })
  return NextResponse.json(categories)
}

async function POST_impl(request: Request) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name, slug } = await request.json()
  const category = await prisma.category.create({
    data: { name, slug },
  })
  return NextResponse.json(category, { status: 201 })
}

export const GET = apiRoute(GET_impl, { retry: true })
export const POST = apiRoute(POST_impl, { retry: false })
