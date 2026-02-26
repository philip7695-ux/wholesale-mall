"use client"

import { useRouter } from "next/navigation"
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

  async function handleDelete() {
    if (!confirm(`"${productName}" 상품을 삭제하시겠습니까?`)) return

    await fetch(`/api/products/${productId}`, { method: "DELETE" })
    router.refresh()
  }

  return (
    <Button variant="destructive" size="sm" onClick={handleDelete}>
      <Trash2 className="mr-1 h-3 w-3" />
      삭제
    </Button>
  )
}
