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
  LayoutDashboard,
  BookOpen,
} from "lucide-react"
import { LanguageSelector } from "@/components/language-selector"
import { useOrderAlerts } from "@/hooks/use-order-alerts"

export function ShopSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const t = useTranslations("shop")
  const tc = useTranslations("common")
  const orderAlerts = useOrderAlerts()

  const navItems = [
    { href: "/products", label: t("productList"), icon: Package },
    { href: "/lookbook", label: t("lookbook"), icon: BookOpen },
    { href: "/cart", label: t("cart"), icon: ShoppingCart },
    { href: "/orders", label: t("orders"), icon: ClipboardList, badge: orderAlerts },
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
      <div className="border-t border-gray-100 px-3 py-4 space-y-2">
        {/* 관리자만 보이는 진입점. 어드민 사이드바의 '쇼핑몰로 이동'과 짝을 이룬다 */}
        {session?.user?.role === "ADMIN" && (
          <Link
            href="/admin"
            className="flex items-center gap-3 px-3 py-2 text-sm font-light tracking-wide text-gray-400 transition-colors hover:bg-gray-50/50 hover:text-[#1A1A1A]"
          >
            <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
            {t("goToAdmin")}
          </Link>
        )}
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
