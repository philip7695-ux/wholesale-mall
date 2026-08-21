import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { signUpload } from "@/lib/storage"
import { apiRoute } from "@/lib/api-route"

// 브라우저가 Cloudinary 로 직접 올릴 서명을 내준다(관리자 전용).
async function POST_impl() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const folder = "lookbooks"
  const signed = signUpload({ folder })
  return NextResponse.json({ ...signed, folder })
}

export const POST = apiRoute(POST_impl, { retry: false })
