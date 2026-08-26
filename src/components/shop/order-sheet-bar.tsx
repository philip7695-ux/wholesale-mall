"use client"

import { useRef, useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { DropZone } from "@/components/ui/drop-zone"
import { Download, Upload, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"

/**
 * 엑셀 일괄 주문 바. 지금 필터된 상품을 이미지 포함 주문서로 내려받아
 * 수량을 채운 뒤 올리면 장바구니에 담긴다. (몰 필터 → 엑셀 → 업로드 → 장바구니)
 */
export function OrderSheetBar({ filters }: { filters: Record<string, string | undefined> }) {
  const t = useTranslations("shop")
  const router = useRouter()
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function query() {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v)
    return p.toString()
  }

  async function download() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/orders/order-sheet?${query()}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || t("orderSheetDownloadFail"))
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const cd = res.headers.get("Content-Disposition") || ""
      const m = cd.match(/filename\*=UTF-8''(.+)/)
      a.download = m ? decodeURIComponent(m[1]) : "order-sheet.xlsx"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(t("orderSheetDownloaded"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("orderSheetDownloadFail"))
    }
    setDownloading(false)
  }

  async function upload(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/orders/order-sheet", { method: "POST", body: fd })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || t("orderSheetUploadFail"))
      // 아무것도 안 담긴 경우(전부 품절이거나 품번 불일치) 명확히 알린다.
      if (!d.added) {
        toast.error(t("orderSheetNoneAdded"))
        if (d.adjustedCount > 0) toast.warning(t("orderSheetAdjusted", { count: d.adjustedCount }))
        return
      }
      toast.success(t("orderSheetUploaded", { count: d.added }))
      // 재고에 맞춰 조정된 항목 안내(주문량 > 재고)
      if (d.adjustedCount > 0) {
        toast.warning(t("orderSheetAdjusted", { count: d.adjustedCount }))
      }
      if (d.unresolvedCount > 0) {
        toast.warning(t("orderSheetUnresolved", { count: d.unresolvedCount }))
      }
      router.push("/cart")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("orderSheetUploadFail"))
    }
    setUploading(false)
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-2">
      <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-gray-500" />
      <span className="text-sm text-gray-600">{t("orderSheetHint")}</span>
      <div className="ml-auto flex gap-2">
        <Button variant="outline" size="sm" onClick={download} disabled={downloading}>
          <Download className="mr-1 h-4 w-4" />
          {downloading ? "..." : t("orderSheetDownload")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
            e.target.value = ""
          }}
        />
        <DropZone
          accept=".xlsx,.xls"
          disabled={uploading}
          onFiles={(f) => f[0] && upload(f[0])}
          overlayText={t("orderSheetDropHint")}
        >
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="mr-1 h-4 w-4" />
            {uploading ? "..." : t("orderSheetUpload")}
          </Button>
        </DropZone>
      </div>
    </div>
  )
}
