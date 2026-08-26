"use client"

import { useRef, useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { DropZone } from "@/components/ui/drop-zone"
import { Download, Upload, FileSpreadsheet, X } from "lucide-react"
import { toast } from "sonner"

interface AdjustedItem {
  code: string
  color: string
  size: string
  requested: number
  available: number
}
interface UploadResult {
  added: number
  adjustedCount: number
  adjusted: AdjustedItem[]
  unresolvedCount: number
}

/**
 * 엑셀 일괄 주문 바. 지금 필터된 상품을 이미지 포함 주문서로 내려받아
 * 수량을 채운 뒤 올리면 장바구니에 담긴다. (몰 필터 → 엑셀 → 업로드 → 장바구니)
 */
export function OrderSheetBar({ filters }: { filters: Record<string, string | undefined> }) {
  const t = useTranslations("shop")
  const router = useRouter()
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
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
      // 결과(담긴 수 + 재고 부족 조정 목록)를 패널로 보여준다.
      setResult({
        added: d.added ?? 0,
        adjustedCount: d.adjustedCount ?? 0,
        adjusted: Array.isArray(d.adjusted) ? d.adjusted : [],
        unresolvedCount: d.unresolvedCount ?? 0,
      })
      if (d.added > 0) toast.success(t("orderSheetUploaded", { count: d.added }))
      else toast.error(t("orderSheetNoneAdded"))
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

      {/* 업로드 결과: 담긴 수 + 재고 부족으로 조정된 항목 목록 */}
      {result && (
        <div className="mt-2 w-full rounded-md border border-gray-200 bg-white p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className={result.added > 0 ? "font-medium text-emerald-700" : "font-medium text-red-600"}>
              {result.added > 0 ? t("orderSheetUploaded", { count: result.added }) : t("orderSheetNoneAdded")}
            </span>
            <div className="flex items-center gap-2">
              {result.added > 0 && (
                <Button size="sm" onClick={() => router.push("/cart")}>
                  {t("orderSheetGoCart")}
                </Button>
              )}
              <button
                type="button"
                onClick={() => setResult(null)}
                aria-label={t("orderSheetClose")}
                className="rounded p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {result.adjusted.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-xs font-medium text-amber-700">
                {t("orderSheetAdjustHeader", { count: result.adjustedCount })}
              </p>
              <div className="max-h-48 overflow-auto rounded border border-gray-100">
                <table className="w-full text-xs">
                  <tbody>
                    {result.adjusted.map((a, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="px-2 py-1 font-mono text-gray-600">{a.code}</td>
                        <td className="px-2 py-1 text-gray-500">{a.color}/{a.size}</td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {a.requested} → <span className={a.available === 0 ? "font-medium text-red-600" : "font-medium text-amber-700"}>{a.available}</span>
                          {a.available === 0 && <span className="ml-1 text-red-500">{t("orderSheetExcluded")}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.adjustedCount > result.adjusted.length && (
                <p className="mt-1 text-xs text-gray-400">
                  {t("orderSheetAndMore", { count: result.adjustedCount - result.adjusted.length })}
                </p>
              )}
            </div>
          )}

          {result.unresolvedCount > 0 && (
            <p className="mt-2 text-xs text-gray-400">{t("orderSheetUnresolved", { count: result.unresolvedCount })}</p>
          )}
        </div>
      )}
    </div>
  )
}
