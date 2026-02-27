import type { NextAuthConfig } from "next-auth"

const locales = ["ko", "en", "zh", "ja"]

function stripLocalePrefix(pathname: string): string {
  for (const locale of locales) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return pathname.slice(locale.length + 1) || "/"
    }
  }
  return pathname
}

function getLocaleFromPath(pathname: string): string {
  for (const locale of locales) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return locale
    }
  }
  return "ko"
}

export const authConfig: NextAuthConfig = {
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.approvalStatus = (user as any).approvalStatus
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as string
        session.user.approvalStatus = token.approvalStatus as string
      }
      return session
    },
    authorized({ auth, request: { nextUrl } }) {
      const { pathname } = nextUrl
      const strippedPath = stripLocalePrefix(pathname)

      // Auth/API routes are always allowed
      if (
        strippedPath.startsWith("/auth") ||
        strippedPath.startsWith("/api")
      ) {
        return true
      }

      // All other pages require login
      if (!auth) {
        const locale = getLocaleFromPath(pathname)
        const loginUrl = new URL(
          locale === "ko" ? "/auth/login" : `/${locale}/auth/login`,
          nextUrl.origin,
        )
        loginUrl.searchParams.set("callbackUrl", pathname)
        return Response.redirect(loginUrl)
      }

      // Admin routes require ADMIN role
      if (strippedPath.startsWith("/admin")) {
        return auth.user.role === "ADMIN"
      }

      return true
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
  },
}
