"use client"

import { useEffect, useState } from "react"
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
  CreditCard,
  Crown,
  ExternalLink,
  LogOut,
  ImageIcon,
  Tag,
  BookOpen,
  TrendingUp,
} from "lucide-react"

export function AdminSidebar() {
  const pathname = usePathname()
  const t = useTranslations("admin")
  const ts = useTranslations("shop")
  const tc = useTranslations("common")

  // 처리 안 된 신규 주문·가입 신청 수. 빨간 배지로 알린다.
  // 60초마다 갱신하고, 다른 탭에서 돌아오면 즉시 다시 센다.
  const [counts, setCounts] = useState<{ newOrders: number; pendingMembers: number }>({
    newOrders: 0,
    pendingMembers: 0,
  })
  useEffect(() => {
    let alive = true
    const load = () =>
      fetch("/api/admin/notifications")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d) setCounts({ newOrders: d.newOrders ?? 0, pendingMembers: d.pendingMembers ?? 0 })
        })
        .catch(() => {})
    load()
    const id = setInterval(load, 60_000)
    const onFocus = () => load()
    window.addEventListener("focus", onFocus)
    return () => {
      alive = false
      clearInterval(id)
      window.removeEventListener("focus", onFocus)
    }
  }, [])

  const navItems = [
    { href: "/admin", label: t("dashboard"), icon: LayoutDashboard },
    { href: "/admin/products", label: t("productMgmt"), icon: Package },
    { href: "/admin/orders", label: t("orderMgmt"), icon: ShoppingCart, badge: counts.newOrders },
    { href: "/admin/revenue", label: t("revenueTitle"), icon: TrendingUp },
    { href: "/admin/members", label: t("memberMgmt"), icon: Users, badge: counts.pendingMembers },
    { href: "/admin/settings/exchange-rates", label: t("exchangeRates"), icon: ArrowLeftRight },
    { href: "/admin/settings/grades", label: t("gradeSettings"), icon: Crown },
    { href: "/admin/settings/payment", label: t("paymentSettings"), icon: CreditCard },
    { href: "/admin/settings/pricing", label: t("pricingSettings"), icon: Tag },
    { href: "/admin/settings/appearance", label: t("appearanceSettings"), icon: ImageIcon },
    { href: "/admin/lookbooks", label: t("lookbookMgmt"), icon: BookOpen },
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
