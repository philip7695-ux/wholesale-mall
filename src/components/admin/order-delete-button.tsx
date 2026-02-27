"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

export function OrderDeleteButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm("정말 이 주문을 영구 삭제하시겠습니까?")) return

    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}?permanent=true`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "삭제 실패")
      }

      toast.success("주문이 삭제되었습니다.")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "삭제에 실패했습니다.")
    }
    setLoading(false)
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleDelete}
      disabled={loading}
    >
      <Trash2 className="mr-1 h-3.5 w-3.5" />
      {loading ? "삭제중..." : "삭제"}
    </Button>
  )
}
