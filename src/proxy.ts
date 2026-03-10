import createIntlMiddleware from "next-intl/middleware"
import NextAuth from "next-auth"
import { authConfig } from "@/lib/auth.config"
import { routing } from "@/i18n/routing"
import { NextRequest, NextResponse } from "next/server"

const intlMiddleware = createIntlMiddleware(routing)

const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token"

/** 세션 쿠키에서 Max-Age / Expires 제거 → session cookie (브라우저 닫으면 삭제) */
function stripMaxAge(response: NextResponse): NextResponse {
  const setCookie = response.headers.getSetCookie()
  if (setCookie.length === 0) return response

  response.headers.delete("set-cookie")
  for (const cookie of setCookie) {
    if (cookie.includes(SESSION_COOKIE_NAME)) {
      const modified = cookie
        .replace(/;\s*Max-Age=[^;]*/gi, "")
        .replace(/;\s*Expires=[^;]*/gi, "")
      response.headers.append("set-cookie", modified)
    } else {
      response.headers.append("set-cookie", cookie)
    }
  }

  return response
}

const authMiddleware = NextAuth({ ...authConfig, trustHost: true }).auth(
  (req) => {
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
  },
)

// auth() 래퍼가 설정한 쿠키에서도 Max-Age 제거
export default async function proxy(
  req: NextRequest,
  ...rest: any[]
) {
  const response = await (authMiddleware as any)(req, ...rest)
  if (response) {
    return stripMaxAge(response)
  }
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
}
