"use client"

import { signOut } from "next-auth/react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { LogOut } from "lucide-react"

export function LogoutButton() {
  const t = useTranslations("shop")
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => signOut({ callbackUrl: "/auth/login" })}
    >
      <LogOut className="mr-1 h-3 w-3" />
      {t("logout")}
    </Button>
  )
}
