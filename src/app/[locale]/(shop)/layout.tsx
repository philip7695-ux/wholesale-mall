import { ShopHeader } from "@/components/shop/header"
import { ShopSidebar } from "@/components/shop/sidebar"
import { AuthSessionProvider } from "@/components/shop/session-provider"
import { auth } from "@/lib/auth"
import { redirect } from "@/i18n/navigation"
import { getLocale, getTranslations } from "next-intl/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LanguageSelector } from "@/components/language-selector"
import { LogoutButton } from "@/components/shop/logout-button"

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const session = await auth().catch(() => null)

  // 미로그인 → 로그인 페이지
  if (!session) {
    const locale = await getLocale()
    return redirect({ href: "/auth/login", locale })
  }

  // 미승인 일반 회원 → 대기 페이지 (관리자는 통과)
  if (session.user.role !== "ADMIN" && session.user.approvalStatus !== "APPROVED") {
    const t = await getTranslations("auth")
    return (
      <AuthSessionProvider>
        <div className="flex min-h-screen items-center justify-center bg-[#F9F9F9] p-4">
          <div className="absolute right-4 top-4 flex items-center gap-2">
            <LanguageSelector />
            <LogoutButton />
          </div>
          <Card className="w-full max-w-md text-center border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="font-light tracking-wide">{t("pendingApprovalTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground font-light">{t("pendingApprovalDesc")}</p>
              {session.user.approvalStatus === "REJECTED" && (
                <p className="text-sm text-destructive">{t("approvalRejected")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </AuthSessionProvider>
    )
  }

  return (
    <AuthSessionProvider>
      <div className="flex h-screen overflow-hidden bg-[#F9F9F9]">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <ShopSidebar />
        </div>

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <ShopHeader />
          <main className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthSessionProvider>
  )
}
