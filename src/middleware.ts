import createIntlMiddleware from "next-intl/middleware"
import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import { routing } from "@/i18n/routing"
import { NextRequest, NextResponse } from "next/server"

const intlMiddleware = createIntlMiddleware(routing)
const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl

  // Skip locale routing for API and static assets
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/public") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next()
  }

  return intlMiddleware(req)
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
}
