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
    <aside className="flex h-screen w-56 flex-shrink-0 flex-col border-r bg-white">
      <div className="flex h-14 items-center border-b px-5">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-white">
            W
          </div>
          {t("logo")}
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t px-3 py-3">
        {session && (
          <button
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            {tc("logout")}
          </button>
        )}
      </div>
    </aside>
  )
}
