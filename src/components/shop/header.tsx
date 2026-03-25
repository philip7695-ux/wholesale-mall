"use client"

import { Link } from "@/i18n/navigation"
import { useSession, signOut } from "next-auth/react"
import { Menu, LogOut, Search, User } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { LanguageSelector } from "@/components/language-selector"
import { useState } from "react"
import { ShoppingCart, Package, ClipboardList } from "lucide-react"

export function ShopHeader() {
  const { data: session } = useSession()
  const t = useTranslations("shop")
  const tc = useTranslations("common")
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b bg-white">
      {/* Top bar */}
      <div className="flex h-16 items-center justify-between px-6 lg:px-10">
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

        {/* Desktop: Logo */}
        <Link href="/products" className="hidden lg:block">
          <span className="text-xl font-light tracking-[0.2em] uppercase text-[#1A1A1A]">
            {t("logo")}
          </span>
        </Link>

        {/* Desktop: Center nav */}
        <nav className="hidden lg:flex items-center gap-10">
          <Link
            href="/products"
            className="text-xs font-medium uppercase tracking-[0.15em] text-[#1A1A1A] hover:text-gray-500 transition-colors"
          >
            {t("allBrands")}
          </Link>
          <Link
            href="/products?sort=newest"
            className="text-xs font-medium uppercase tracking-[0.15em] text-[#1A1A1A] hover:text-gray-500 transition-colors"
          >
            {t("newArrivals")}
          </Link>
          <Link
            href="/orders"
            className="text-xs font-medium uppercase tracking-[0.15em] text-[#1A1A1A] hover:text-gray-500 transition-colors"
          >
            {t("orders")}
          </Link>
        </nav>

        {/* Right: actions */}
        <div className="flex items-center gap-5">
          <LanguageSelector />
          <Link href="/products" className="hidden lg:block">
            <Search className="h-4 w-4 text-gray-500 hover:text-[#1A1A1A] transition-colors" />
          </Link>
          <Link href="/cart" className="hidden lg:block">
            <ShoppingCart className="h-4 w-4 text-gray-500 hover:text-[#1A1A1A] transition-colors" />
          </Link>
          {session ? (
            <Link href="/mypage" className="hidden lg:flex items-center gap-2">
              <User className="h-4 w-4 text-gray-500 hover:text-[#1A1A1A] transition-colors" />
            </Link>
          ) : (
            <Link href="/auth/login">
              <Button size="sm" variant="ghost" className="text-xs uppercase tracking-wider">
                {tc("login")}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
