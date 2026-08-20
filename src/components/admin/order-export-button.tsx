"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Rows3, Columns3 } from "lucide-react"
import { toast } from "sonner"

export function OrderExportButton() {
  const [loading, setLoading] = useState(false)

  /**
   * layout="rows" : 사이즈를 세로로 (한 사이즈 = 한 행)
   * layout="grid" : 사이즈를 가로로 (생산 발주서·창고 피킹용)
   */
  async function handleExport(layout: "rows" | "grid") {
    setLoading(true)
    try {
      const res = await fetch(`/api/orders/export?layout=${layout}`)
      if (!res.ok) throw new Error("다운로드 실패")

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const disposition = res.headers.get("Content-Disposition") || ""
      const match = disposition.match(/filename\*=UTF-8''(.+)/)
      a.download = match ? decodeURIComponent(match[1]) : "주문목록.xlsx"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success("엑셀 파일이 다운로드되었습니다.")
    } catch {
      toast.error("엑셀 다운로드에 실패했습니다.")
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={() => handleExport("rows")} disabled={loading}>
        <Rows3 className="mr-2 h-4 w-4" />
        {loading ? "다운로드중..." : "엑셀 (사이즈 세로)"}
      </Button>
      <Button variant="outline" onClick={() => handleExport("grid")} disabled={loading}>
        <Columns3 className="mr-2 h-4 w-4" />
        {loading ? "다운로드중..." : "엑셀 (사이즈 가로)"}
      </Button>
    </div>
  )
}
