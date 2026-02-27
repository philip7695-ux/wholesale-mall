"use client"

import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Check, X, Trash2 } from "lucide-react"

export function MemberApprovalButton({
  memberId,
  currentStatus,
}: {
  memberId: string
  currentStatus: string
}) {
  const router = useRouter()
  const t = useTranslations("admin")
  const tc = useTranslations("common")

  async function handleApproval(approvalStatus: string) {
    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalStatus }),
    })

    if (res.ok) {
      toast.success(approvalStatus === "APPROVED" ? t("memberApproved") : t("memberRejected"))
      router.refresh()
    } else {
      toast.error(t("memberProcessError"))
    }
  }

  async function handleDelete() {
    if (!confirm(t("memberDeleteConfirm"))) return

    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: "DELETE",
    })

    if (res.ok) {
      toast.success(t("memberDeleted"))
      router.refresh()
    } else {
      const data = await res.json()
      toast.error(data.error || t("memberDeleteError"))
    }
  }

  if (currentStatus === "APPROVED") {
    return (
      <Button variant="destructive" size="sm" onClick={handleDelete}>
        <Trash2 className="mr-1 h-3 w-3" /> {tc("delete")}
      </Button>
    )
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => handleApproval("APPROVED")}>
        <Check className="mr-1 h-3 w-3" /> {t("memberApprove")}
      </Button>
      {currentStatus !== "REJECTED" ? (
        <Button variant="destructive" size="sm" onClick={() => handleApproval("REJECTED")}>
          <X className="mr-1 h-3 w-3" /> {t("memberReject")}
        </Button>
      ) : (
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="mr-1 h-3 w-3" /> {tc("delete")}
        </Button>
      )}
    </div>
  )
}
