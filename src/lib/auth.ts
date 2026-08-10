import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { authConfig } from "@/lib/auth.config"
import { rateLimit } from "@/lib/rate-limit"

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email as string

        // 브루트포스 완화: 이메일당 15분에 10회 실패 시도까지만 허용 (best-effort)
        if (!rateLimit(`login:${email.toLowerCase()}`, 10, 15 * 60 * 1000)) {
          console.warn("[Auth] rate limit exceeded for login")
          return null
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email },
          })

          if (!user) {
            console.warn("[Auth] login failed: user not found")
            return null
          }

          const isValid = await compare(
            credentials.password as string,
            user.password,
          )

          if (!isValid) {
            console.warn("[Auth] login failed: invalid password")
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            approvalStatus: user.approvalStatus,
            buyerGrade: user.buyerGrade,
          }
        } catch (error) {
          console.error("[Auth] DB error:", error)
          return null
        }
      },
    }),
  ],
})
