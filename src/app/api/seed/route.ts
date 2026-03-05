import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hash } from "bcryptjs"

// One-time seed endpoint – delete after use
export async function POST(request: Request) {
  const { secret } = await request.json()
  if (secret !== process.env.AUTH_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const adminPassword = await hash("admin123", 12)
    const admin = await prisma.user.upsert({
      where: { email: "admin@wholesale.com" },
      update: { password: adminPassword, role: "ADMIN", approvalStatus: "APPROVED" },
      create: {
        email: "admin@wholesale.com",
        password: adminPassword,
        name: "관리자",
        role: "ADMIN",
        approvalStatus: "APPROVED",
      },
    })

    const categories = [
      { name: "아우터", slug: "outer" },
      { name: "상의", slug: "tops" },
      { name: "하의", slug: "bottoms" },
      { name: "원피스", slug: "dresses" },
      { name: "액세서리", slug: "accessories" },
    ]
    for (const cat of categories) {
      await prisma.category.upsert({
        where: { slug: cat.slug },
        update: {},
        create: { name: cat.name, slug: cat.slug },
      })
    }

    return NextResponse.json({ ok: true, adminId: admin.id })
  } catch (e: any) {
    console.error("[seed] error:", e)
    return NextResponse.json({ error: e.message, stack: e.stack?.split("\n").slice(0, 5) }, { status: 500 })
  }
}
