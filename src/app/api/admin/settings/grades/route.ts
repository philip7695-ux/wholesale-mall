import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getGradeConfig } from "@/lib/grade.server"

export async function GET() {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const configs = await getGradeConfig()
  return NextResponse.json(configs)
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { grades } = await request.json() as {
      grades: { grade: string; discountRate: number; moqRate: number; threshold: number }[]
    }

    if (!Array.isArray(grades) || grades.length === 0) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 })
    }

    const validGrades = ["BRONZE", "SILVER", "GOLD", "VIP"]

    for (const g of grades) {
      if (!validGrades.includes(g.grade)) {
        return NextResponse.json({ error: `Invalid grade: ${g.grade}` }, { status: 400 })
      }
      if (typeof g.discountRate !== "number" || g.discountRate < 0 || g.discountRate > 1) {
        return NextResponse.json({ error: `Invalid discountRate for ${g.grade}` }, { status: 400 })
      }
      if (typeof g.moqRate !== "number" || g.moqRate < 0 || g.moqRate > 1) {
        return NextResponse.json({ error: `Invalid moqRate for ${g.grade}` }, { status: 400 })
      }
      if (typeof g.threshold !== "number" || g.threshold < 0) {
        return NextResponse.json({ error: `Invalid threshold for ${g.grade}` }, { status: 400 })
      }
    }

    const results = await prisma.$transaction(
      grades.map((g) =>
        prisma.gradeConfig.upsert({
          where: { grade: g.grade },
          update: {
            discountRate: g.discountRate,
            moqRate: g.moqRate,
            threshold: g.threshold,
          },
          create: {
            grade: g.grade,
            discountRate: g.discountRate,
            moqRate: g.moqRate,
            threshold: g.threshold,
          },
        })
      )
    )

    return NextResponse.json(results)
  } catch (error) {
    console.error("Grade config update error:", error)
    return NextResponse.json({ error: "Failed to update grade config" }, { status: 500 })
  }
}
