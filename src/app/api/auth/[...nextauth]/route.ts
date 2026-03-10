import { handlers } from "@/lib/auth"

const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token"

/** 세션 쿠키에서 Max-Age / Expires 제거 → session cookie (브라우저 닫으면 삭제) */
function stripMaxAge(response: Response): Response {
  const setCookie = response.headers.getSetCookie()
  if (setCookie.length === 0) return response

  const newHeaders = new Headers(response.headers)
  newHeaders.delete("set-cookie")
  for (const cookie of setCookie) {
    if (cookie.includes(SESSION_COOKIE_NAME)) {
      const modified = cookie
        .replace(/;\s*Max-Age=[^;]*/gi, "")
        .replace(/;\s*Expires=[^;]*/gi, "")
      newHeaders.append("set-cookie", modified)
    } else {
      newHeaders.append("set-cookie", cookie)
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })
}

export async function GET(...args: Parameters<typeof handlers.GET>) {
  const response = await handlers.GET(...args)
  return stripMaxAge(response)
}

export async function POST(...args: Parameters<typeof handlers.POST>) {
  const response = await handlers.POST(...args)
  return stripMaxAge(response)
}
