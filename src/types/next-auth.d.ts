import "next-auth"

declare module "next-auth" {
  interface User {
    role?: string
    approvalStatus?: string
    buyerGrade?: string
    tradeType?: string
    currency?: string | null
  }

  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      approvalStatus: string
      buyerGrade: string
      tradeType: string
      currency: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
    approvalStatus?: string
    buyerGrade?: string
    tradeType?: string
    currency?: string | null
  }
}
