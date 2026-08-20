"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { FileDown, Loader2 } from "lucide-react"

/**
 * 창고에 보낼 발주서를 내려받는다.
 *
 * 주문이 들어오면 먼저 이걸 뽑아 창고에 보낸다. 창고가 실물을 확인해
 * 수량을 적어 회신하면 그 답을 보고 수량을 고친다. 그래서 수량을
 * 고치기 전 단계에서 가장 먼저 눌러야 하는 버튼이다.
 *
 * 창고마다 익숙한 형식이 달라 가로·세로 둘 다 준다.
 */
export function WarehouseSheetButton({ orderId }: { orderId: string }) {
  const t = useTranslations("admin")
  const [busy, setBusy] = useState<string | null>(null)

  async function download(layout: "grid" | "rows") {
    setBusy(layout)
    try {
      const res = await fetch(`/api/orders/${orderId}/warehouse-sheet?layout=${layout}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || t("warehouseSheetFail"))
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const disposition = res.headers.get("Content-Disposition") || ""
      const match = disposition.match(/filename\*=UTF-8''(.+)/)
      a.download = match ? decodeURIComponent(match[1]) : "warehouse-sheet.xlsx"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("warehouseSheetFail"))
    }
    setBusy(null)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" disabled={!!busy} onClick={() => download("grid")}>
        {busy === "grid" ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileDown className="mr-1 h-3.5 w-3.5" />
        )}
        {t("warehouseSheetGrid")}
      </Button>
      <Button variant="outline" size="sm" disabled={!!busy} onClick={() => download("rows")}>
        {busy === "rows" ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileDown className="mr-1 h-3.5 w-3.5" />
        )}
        {t("warehouseSheetRows")}
      </Button>
      <span className="text-xs text-muted-foreground">{t("warehouseSheetHint")}</span>
    </div>
  )
}
