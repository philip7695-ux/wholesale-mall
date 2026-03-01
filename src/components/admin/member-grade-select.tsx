"use client"

import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

const grades = ["BRONZE", "SILVER", "GOLD", "VIP"] as const

export function MemberGradeSelect({
  memberId,
  currentGrade,
}: {
  memberId: string
  currentGrade: string
}) {
  const router = useRouter()
  const t = useTranslations("admin")

  async function handleChange(buyerGrade: string) {
    if (buyerGrade === currentGrade) return

    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buyerGrade }),
    })

    if (res.ok) {
      toast.success(t("gradeChanged"))
      router.refresh()
    } else {
      toast.error(t("gradeChangeFail"))
    }
  }

  return (
    <Select value={currentGrade} onValueChange={handleChange}>
      <SelectTrigger className="h-7 w-28 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {grades.map((g) => (
          <SelectItem key={g} value={g} className="text-xs">
            {g}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
