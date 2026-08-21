import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { deleteResource } from "@/lib/storage"
import { apiRoute } from "@/lib/api-route"

async function DELETE_impl(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const item = await prisma.lookbook.findUnique({ where: { id } })
  if (!item) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 })

  // Cloudinary 원본도 지운다. 실패해도 레코드는 지워 목록에서 사라지게 한다.
  await deleteResource(item.publicId, "raw").catch((e) =>
    console.error("[lookbook delete] cloudinary:", e),
  )
  await prisma.lookbook.delete({ where: { id } })
  return NextResponse.json({ message: "삭제되었습니다." })
}

async function PATCH_impl(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { id } = await params
  const body = await request.json()
  const data: Record<string, unknown> = {}
  if (typeof body.isActive === "boolean") data.isActive = body.isActive
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim()
  const updated = await prisma.lookbook.update({ where: { id }, data })
  return NextResponse.json(updated)
}

export const DELETE = apiRoute(DELETE_impl, { retry: false })
export const PATCH = apiRoute(PATCH_impl, { retry: false })
