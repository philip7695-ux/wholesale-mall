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
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b bg-white px-4">
      {/* Mobile: hamburger menu */}
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64">
            <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
            <div className="flex items-center gap-2 pb-4 pt-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
                W
              </div>
              <span className="text-lg font-bold">{t("logo")}</span>
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
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-accent"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
            {session && (
              <div className="mt-4 border-t pt-4">
                <button
                  onClick={() => signOut({ callbackUrl: "/auth/login" })}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-500 hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  {tc("logout")}
                </button>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: empty left space (sidebar handles nav) */}
      <div className="hidden md:block" />

      {/* Right: language + welcome */}
      <div className="flex items-center gap-3">
        <LanguageSelector />
        {session ? (
          <span className="text-sm text-muted-foreground">
            {t("welcome", { name: session.user?.name || "" })}
          </span>
        ) : (
          <Link href="/auth/login">
            <Button size="sm">{tc("login")}</Button>
          </Link>
        )}
      </div>
    </header>
  )
}
