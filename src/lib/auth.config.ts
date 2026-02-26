import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  providers: [], // Credentials provider는 auth.ts에서 추가 (Node.js 런타임 필요)
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

      // 인증/API는 항상 허용
      if (
        pathname.startsWith("/auth") ||
        pathname.startsWith("/api")
      ) {
        return true
      }

      // 그 외 모든 페이지는 로그인 필수
      if (!auth) return false

      // Admin routes는 ADMIN 역할 필요
      if (pathname.startsWith("/admin")) {
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
