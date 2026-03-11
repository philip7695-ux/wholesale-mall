"use client"

import { useTranslations } from "next-intl"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

export function MemberRoleSelect({
  memberId,
  currentRole,
  isSelf,
}: {
  memberId: string
  currentRole: string
  isSelf: boolean
}) {
  const t = useTranslations("admin")

  async function handleChange(role: string) {
    if (role === currentRole) return

    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    })

    if (res.ok) {
      toast.success(t("roleChanged"))
      window.location.reload()
    } else {
      const data = await res.json()
      toast.error(data.error || t("roleChangeFail"))
    }
  }

  return (
    <Select value={currentRole} onValueChange={handleChange} disabled={isSelf}>
      <SelectTrigger className="h-7 w-28 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="BUYER" className="text-xs">
          {t("buyer")}
        </SelectItem>
        <SelectItem value="ADMIN" className="text-xs">
          {t("adminRole")}
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
