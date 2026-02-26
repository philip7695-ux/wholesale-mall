"use client"

import { useRouter } from "next/navigation"
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

  async function handleDelete() {
    if (!confirm("정말 이 회원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return

    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: "DELETE",
    })

    if (res.ok) {
      toast.success("회원이 삭제되었습니다.")
      router.refresh()
    } else {
      const data = await res.json()
      toast.error(data.error || "삭제 중 오류가 발생했습니다.")
    }
  }

  if (currentStatus === "APPROVED") {
    return (
      <Button variant="destructive" size="sm" onClick={handleDelete}>
        <Trash2 className="mr-1 h-3 w-3" /> 삭제
      </Button>
    )
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => handleApproval("APPROVED")}>
        <Check className="mr-1 h-3 w-3" /> 승인
      </Button>
      {currentStatus !== "REJECTED" ? (
        <Button variant="destructive" size="sm" onClick={() => handleApproval("REJECTED")}>
          <X className="mr-1 h-3 w-3" /> 거절
        </Button>
      ) : (
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <Trash2 className="mr-1 h-3 w-3" /> 삭제
        </Button>
      )}
    </div>
  )
}
