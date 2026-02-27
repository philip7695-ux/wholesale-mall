"use client"

import { Link, usePathname } from "@/i18n/navigation"
import { signOut } from "next-auth/react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { LanguageSelector } from "@/components/language-selector"

export function AdminSidebar() {
  const pathname = usePathname()
  const t = useTranslations("admin")
  const ts = useTranslations("shop")
  const tc = useTranslations("common")

  const navItems = [
    { href: "/admin", label: t("dashboard") },
    { href: "/admin/products", label: t("productMgmt") },
    { href: "/admin/orders", label: t("orderMgmt") },
    { href: "/admin/members", label: t("memberMgmt") },
  ]

  return (
    <aside className="flex h-screen w-60 flex-shrink-0 flex-col border-r bg-white">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/admin" className="text-lg font-bold">
          {t("logo")}
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="space-y-1 border-t p-3">
        <Link href="/" className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
          {ts("goToShop")}
        </Link>
        <LanguageSelector />
        <button
          onClick={() => signOut({ callbackUrl: "/auth/login" })}
          className="w-full rounded-md px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50"
        >
          {tc("logout")}
        </button>
      </div>
    </aside>
  )
}
