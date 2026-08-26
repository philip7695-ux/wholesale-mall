"use client"

import { useRef, useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { DropZone } from "@/components/ui/drop-zone"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Download, Upload, FileSpreadsheet, X } from "lucide-react"
import { AGE_GROUP_KEYS, type AgeGroupValue } from "@/lib/age-group"
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

interface Option {
  value: string
  label: string
}

/**
 * 엑셀 일괄 주문 바.
 *  - 주문서 받기: 팝업에서 연도·연령대·카테고리를 중복선택해 필터된 상품을
 *    이미지 포함 주문서로 내려받는다.
 *  - 주문서 올리기: 수량을 채운 주문서를 올려 장바구니에 담는다.
 */
export function OrderSheetBar({
  years,
  ageGroups,
  categories,
}: {
  years: Option[]
  ageGroups: AgeGroupValue[]
  categories: Option[]
}) {
  const t = useTranslations("shop")
  const router = useRouter()
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selYears, setSelYears] = useState<Set<string>>(new Set())
  const [selAges, setSelAges] = useState<Set<string>>(new Set())
  const [selCats, setSelCats] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, v: string) {
    const next = new Set(set)
    next.has(v) ? next.delete(v) : next.add(v)
    setter(next)
  }
  function toggleAll(all: string[], set: Set<string>, setter: (s: Set<string>) => void) {
    setter(set.size === all.length ? new Set() : new Set(all))
  }

  function errMessage(
    d: { code?: string; count?: number; limit?: number; error?: string } | null | undefined,
    fallback: string,
  ) {
    const keys: Record<string, string> = {
      noProducts: "orderSheetErrNoProducts",
      tooManyStyles: "orderSheetErrTooMany",
      noFile: "orderSheetErrNoFile",
      readFail: "orderSheetErrReadFail",
      noHeader: "orderSheetErrNoHeader",
      noQty: "orderSheetErrNoQty",
    }
    if (d?.code && keys[d.code]) {
      return t(keys[d.code], { count: d.count ?? 0, limit: d.limit ?? 0 })
    }
    return d?.error || fallback
  }

  async function download() {
    setDownloading(true)
    try {
      const p = new URLSearchParams()
      if (selCats.size) p.set("categories", [...selCats].join(","))
      if (selYears.size) p.set("years", [...selYears].join(","))
      if (selAges.size) p.set("ageGroups", [...selAges].join(","))
      const res = await fetch(`/api/orders/order-sheet?${p.toString()}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(errMessage(d, t("orderSheetDownloadFail")))
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
      setPickerOpen(false)
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
      if (!res.ok) throw new Error(errMessage(d, t("orderSheetUploadFail")))
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

  // 다중선택 칩 그룹
  function ChipGroup({
    title,
    options,
    selected,
    onToggle,
    onAll,
  }: {
    title: string
    options: Option[]
    selected: Set<string>
    onToggle: (v: string) => void
    onAll: () => void
  }) {
    if (options.length === 0) return null
    const allOn = selected.size === options.length
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">{title}</span>
          <button
            type="button"
            onClick={onAll}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              allOn ? "bg-[#1A1A1A] text-white" : "border border-gray-200 text-gray-500 hover:border-gray-400"
            }`}
          >
            {t("orderSheetSelectAll")}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => {
            const on = selected.has(o.value)
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onToggle(o.value)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  on ? "border-[#1A1A1A] bg-[#1A1A1A] text-white" : "border-gray-200 text-gray-600 hover:border-gray-400"
                }`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const ageOptions: Option[] = ageGroups.map((a) => ({ value: a, label: t(AGE_GROUP_KEYS[a]) }))

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50/70 px-3 py-2">
      <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-gray-500" />
      <span className="text-sm text-gray-600">{t("orderSheetHint")}</span>
      <div className="ml-auto flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)} disabled={downloading}>
          <Download className="mr-1 h-4 w-4" />
          {t("orderSheetDownload")}
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

      {/* 다중선택 팝업 */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("orderSheetPickerTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-1">
            <ChipGroup
              title={t("season")}
              options={years}
              selected={selYears}
              onToggle={(v) => toggle(selYears, setSelYears, v)}
              onAll={() => toggleAll(years.map((y) => y.value), selYears, setSelYears)}
            />
            <ChipGroup
              title={t("ageGroup")}
              options={ageOptions}
              selected={selAges}
              onToggle={(v) => toggle(selAges, setSelAges, v)}
              onAll={() => toggleAll(ageOptions.map((a) => a.value), selAges, setSelAges)}
            />
            <ChipGroup
              title={t("category")}
              options={categories}
              selected={selCats}
              onToggle={(v) => toggle(selCats, setSelCats, v)}
              onAll={() => toggleAll(categories.map((c) => c.value), selCats, setSelCats)}
            />
            <p className="text-xs text-gray-400">{t("orderSheetPickerHint")}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)} disabled={downloading}>
              {t("orderSheetClose")}
            </Button>
            <Button onClick={download} disabled={downloading}>
              <Download className="mr-1 h-4 w-4" />
              {downloading ? "..." : t("orderSheetDownload")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
