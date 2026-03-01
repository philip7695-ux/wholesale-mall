"use client"

import { Link, usePathname } from "@/i18n/navigation"
import { signOut } from "next-auth/react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { LanguageSelector } from "@/components/language-selector"
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  ArrowLeftRight,
  Landmark,
  ExternalLink,
  LogOut,
} from "lucide-react"

export function AdminSidebar() {
  const pathname = usePathname()
  const t = useTranslations("admin")
  const ts = useTranslations("shop")
  const tc = useTranslations("common")

  const navItems = [
    { href: "/admin", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/admin/products", label: t("productMgmt"), icon: Package },
    { href: "/admin/orders", label: t("orderMgmt"), icon: ShoppingCart },
    { href: "/admin/members", label: t("memberMgmt"), icon: Users },
    { href: "/admin/settings/exchange-rates", label: t("exchangeRates"), icon: ArrowLeftRight },
    { href: "/admin/settings/wise", label: t("wiseSettings"), icon: Landmark },
  ]

  return (
    <aside className="flex h-screen w-60 flex-shrink-0 flex-col bg-sidebar">
      <div className="flex h-14 items-center border-b border-sidebar-border px-5">
        <Link href="/admin" className="flex items-center gap-2 text-lg font-bold text-sidebar-primary-foreground">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sidebar-primary text-xs font-bold text-white">
            W
          </div>
          {t("logo")}
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="space-y-0.5 border-t border-sidebar-border px-3 py-3">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        >
          <ExternalLink className="h-4 w-4" />
          {ts("goToShop")}
        </Link>
        <LanguageSelector className="!border-sidebar-border !bg-sidebar !text-sidebar-foreground" />
        <button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut className="h-4 w-4" />
          {tc("logout")}
        </button>
      </div>
    </aside>
  )
}
