"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

export function OrderDeleteButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const t = useTranslations("admin")
  const tc = useTranslations("common")
  const [loading, setLoading] = useState(false)

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    if (!confirm(t("orderDeleteConfirm"))) return

    setLoading(true)
    try {
      const res = await fetch(`/api/orders/${orderId}?permanent=true`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || t("orderDeleteFail"))
      }

      toast.success(t("orderDeleted"))
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("orderDeleteError"))
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
      {loading ? tc("deleting") : tc("delete")}
    </Button>
  )
}
