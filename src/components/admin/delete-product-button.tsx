"use client"

import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"

export function DeleteProductButton({
  productId,
  productName,
}: {
  productId: string
  productName: string
}) {
  const router = useRouter()
  const t = useTranslations("admin")
  const tc = useTranslations("common")

  async function handleDelete() {
    if (!confirm(t("deleteConfirm", { name: productName }))) return

    await fetch(`/api/products/${productId}`, { method: "DELETE" })
    router.refresh()
  }

  return (
    <Button variant="destructive" size="sm" onClick={handleDelete}>
      <Trash2 className="mr-1 h-3 w-3" />
      {tc("delete")}
    </Button>
  )
}
