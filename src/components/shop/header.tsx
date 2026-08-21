"use client"

import { Link } from "@/i18n/navigation"
import { useSession, signOut } from "next-auth/react"
import { Menu, LogOut } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { LanguageSelector } from "@/components/language-selector"
import { useState } from "react"
import { ShoppingCart, Package, ClipboardList, User, LayoutDashboard, BookOpen } from "lucide-react"
import { useOrderAlerts } from "@/hooks/use-order-alerts"

export function ShopHeader() {
  const { data: session } = useSession()
  const t = useTranslations("shop")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)
  const orderAlerts = useOrderAlerts()

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white lg:hidden">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 lg:px-10">
        {/* Mobile: hamburger */}
        <div className="lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-white">
              <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
              <div className="flex items-center gap-2 pb-6 pt-2">
                <span className="text-xl font-light tracking-wider uppercase">{t("logo")}</span>
              </div>
              <nav className="flex flex-col gap-1">
                {[
                  { href: "/products", label: t("productList"), icon: Package },
                  { href: "/lookbook", label: t("lookbook"), icon: BookOpen },
                  { href: "/cart", label: t("cart"), icon: ShoppingCart },
                  { href: "/orders", label: t("orders"), icon: ClipboardList, badge: orderAlerts },
                  { href: "/mypage", label: t("mypage"), icon: User },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-none border-b border-gray-100 px-2 py-3.5 text-sm font-light tracking-wide hover:bg-gray-50"
                    >
                      <Icon className="h-4 w-4 text-gray-400" />
                      <span className="flex-1">{item.label}</span>
                      {"badge" in item && (item.badge as number) > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                          {(item.badge as number) > 99 ? "99+" : (item.badge as number)}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </nav>
              {/* 관리자만 보이는 진입점. 데스크톱 사이드바와 동일하게 노출한다 */}
              {session?.user?.role === "ADMIN" && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="mt-4 flex items-center gap-3 rounded-none border-b border-gray-100 px-2 py-3.5 text-sm font-light tracking-wide hover:bg-gray-50"
                >
                  <LayoutDashboard className="h-4 w-4 text-gray-400" />
                  {t("goToAdmin")}
                </Link>
              )}
              {session && (
                <div className="mt-6">
                  <button
                    onClick={() => signOut({ callbackUrl: "/auth/login" })}
                    className="flex w-full items-center gap-3 px-2 py-3 text-sm text-gray-400 hover:text-red-500"
                  >
                    <LogOut className="h-4 w-4" />
                    {tc("logout")}
                  </button>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>

        {/* Logo */}
        <Link href="/products" className="text-xl font-light tracking-[0.2em] uppercase text-[#1A1A1A]">
          {t("logo")}
        </Link>

        {/* Right: actions (헤더 자체가 lg:hidden이므로 모바일 전용) */}
        <div className="flex items-center gap-3">
          <LanguageSelector />
          {session?.user?.name && (
            <span className="text-xs text-gray-500 font-light">
              {t("welcome", { name: session.user.name })}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}
