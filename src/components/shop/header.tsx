"use client"

import { Link } from "@/i18n/navigation"
import { useSession, signOut } from "next-auth/react"
import { Menu, LogOut } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { LanguageSelector } from "@/components/language-selector"
import { useState } from "react"
import { ShoppingCart, Package, ClipboardList, User } from "lucide-react"

export function ShopHeader() {
  const { data: session } = useSession()
  const t = useTranslations("shop")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
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
                  { href: "/cart", label: t("cart"), icon: ShoppingCart },
                  { href: "/orders", label: t("orders"), icon: ClipboardList },
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
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
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

        {/* Right: actions */}
        <div className="hidden lg:flex items-center gap-6">
          <Link
            href="/mypage"
            className="text-sm text-[#1A1A1A] hover:text-gray-500 transition-colors"
          >
            {t("myAccount")}
          </Link>
          <LanguageSelector />
          {session?.user?.name && (
            <span className="text-sm text-gray-500 font-light">
              {t("welcome", { name: session.user.name })}
            </span>
          )}
          {session && (
            <button
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              {tc("logout")}
            </button>
          )}
        </div>
        <div className="lg:hidden flex items-center gap-3">
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
