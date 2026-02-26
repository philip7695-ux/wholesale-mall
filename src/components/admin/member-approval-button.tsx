"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Check, X } from "lucide-react"

export function MemberApprovalButton({
  memberId,
  currentStatus,
}: {
  memberId: string
  currentStatus: string
}) {
  const router = useRouter()

  async function handleApproval(approvalStatus: string) {
    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalStatus }),
    })

    if (res.ok) {
      toast.success(approvalStatus === "APPROVED" ? "승인되었습니다." : "거절되었습니다.")
      router.refresh()
    } else {
      toast.error("처리 중 오류가 발생했습니다.")
    }
  }

  if (currentStatus === "APPROVED") {
    return (
      <Button variant="destructive" size="sm" onClick={() => handleApproval("REJECTED")}>
        <X className="mr-1 h-3 w-3" /> 거절
      </Button>
    )
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => handleApproval("APPROVED")}>
        <Check className="mr-1 h-3 w-3" /> 승인
      </Button>
      {currentStatus !== "REJECTED" && (
        <Button variant="destructive" size="sm" onClick={() => handleApproval("REJECTED")}>
          <X className="mr-1 h-3 w-3" /> 거절
        </Button>
      )}
    </div>
  )
}
