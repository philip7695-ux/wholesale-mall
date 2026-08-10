"use client"

import { Link, usePathname } from "@/i18n/navigation"
import { useSession, signOut } from "next-auth/react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import {
  Package,
  ShoppingCart,
  ClipboardList,
  User,
  LogOut,
} from "lucide-react"
import { LanguageSelector } from "@/components/language-selector"

export function ShopSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const t = useTranslations("shop")
  const tc = useTranslations("common")

  const navItems = [
    { href: "/products", label: t("productList"), icon: Package },
    { href: "/cart", label: t("cart"), icon: ShoppingCart },
    { href: "/orders", label: t("orders"), icon: ClipboardList },
    { href: "/mypage", label: t("mypage"), icon: User },
  ]

  return (
    <aside className="sticky top-0 flex h-screen w-56 flex-shrink-0 flex-col border-r border-gray-100 bg-white">
      <div className="flex h-16 items-center border-b border-gray-100 px-5">
        <Link href="/" className="text-lg font-light tracking-[0.15em] uppercase text-[#1A1A1A]">
          {t("logo")}
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-6">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-none px-3 py-2.5 text-sm font-light tracking-wide transition-colors",
                isActive
                  ? "text-[#1A1A1A] font-normal border-l-2 border-[#1A1A1A] bg-gray-50"
                  : "text-gray-400 hover:text-[#1A1A1A] hover:bg-gray-50/50",
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-gray-100 px-3 py-4 space-y-2">
        {session?.user?.name && (
          <span className="block px-3 text-xs text-gray-400 font-light">
            {t("welcome", { name: session.user.name })}
          </span>
        )}
        <LanguageSelector className="w-full" />
        {session && (
          <button
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-light text-gray-400 hover:text-red-500 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {tc("logout")}
          </button>
        )}
      </div>
    </aside>
  )
}
