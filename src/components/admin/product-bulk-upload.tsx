"use client"

import { useState, useRef } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Download, Upload, FileSpreadsheet, ImagePlus, X, CheckCircle2, AlertCircle, Package, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useLeaveGuard } from "@/hooks/use-leave-guard"

interface UploadResult {
  success: number
  created: number
  updated: number
  failed: { row: number; error: string }[]
}

interface StockUpdateResult {
  updated: number
  failed: { row: number; error: string }[]
}

interface ImageUploadResult {
  success: number
  failed: { file: string; error: string }[]
}

export function ProductBulkUpload() {
  const t = useTranslations("admin")
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = (type: "adult" | "kids") => {
    window.open(`/api/products/template?type=${type}`)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      if (!selected.name.endsWith(".xlsx") && !selected.name.endsWith(".xls")) {
        toast.error(t("bulkExcelOnly"))
        return
      }
      setFile(selected)
      setResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setResult(null)
    setElapsed(0)
    const startedAt = Date.now()
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)

    try {
      // 엑셀을 브라우저에서 파싱해 상품 단위로 청크를 나눈다.
      // 서버 한 번에 다 보내면 상품 수백 개에서 함수 실행시간을 넘긴다.
      setProgress({ done: 0, total: 0, label: t("bulkReadingFile") })
      const XLSX = await import("xlsx")
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" })

      type Chunk = { sheetName: string; rows: Record<string, any>[] }
      const chunks: Chunk[] = []
      let totalProducts = 0

      const PRODUCTS_PER_CHUNK = 20
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName]
        if (!ws) continue
        const rows = XLSX.utils.sheet_to_json(ws) as Record<string, any>[]
        if (rows.length === 0) continue

        // 같은 상품(코드)의 행이 청크 경계로 쪼개지지 않도록 코드 단위로 자른다
        let current: Record<string, any>[] = []
        let seen = new Set<string>()
        for (const row of rows) {
          const key = String(row["상품코드"] ?? row["상품명*"] ?? "").trim()
          if (!seen.has(key) && seen.size >= PRODUCTS_PER_CHUNK) {
            chunks.push({ sheetName, rows: current })
            current = []
            seen = new Set<string>()
          }
          seen.add(key)
          current.push(row)
        }
        if (current.length > 0) chunks.push({ sheetName, rows: current })

        totalProducts += new Set(
          rows.map((r) => String(r["상품코드"] ?? r["상품명*"] ?? "").trim()),
        ).size
      }

      if (chunks.length === 0) throw new Error(t("bulkNoData"))

      const merged: UploadResult = { success: 0, created: 0, updated: 0, failed: [] }
      setProgress({ done: 0, total: totalProducts, label: "" })

      for (let i = 0; i < chunks.length; i++) {
        const res = await fetch("/api/products/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chunks[i]),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || t("bulkUploadFail"))
        }

        const data: UploadResult = await res.json()
        merged.success += data.success
        merged.created += data.created ?? 0
        merged.updated += data.updated ?? 0
        merged.failed.push(...data.failed)
        setProgress({ done: merged.success + merged.failed.length, total: totalProducts, label: "" })
      }

      setResult(merged)

      if (merged.success > 0) {
        toast.success(t("bulkProductsRegistered", { count: merged.success }))
      }
      if (merged.failed.length > 0) {
        toast.error(t("bulkErrors", { count: merged.failed.length }))
      }
    } catch (err: any) {
      toast.error(err.message || t("bulkUploadError"))
    } finally {
      clearInterval(timer)
      setProgress(null)
      setUploading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setResult(null)
    setProgress(null)
    setElapsed(0)
    if (inputRef.current) inputRef.current.value = ""
  }

  // ── Stock update state ──
  const [stockFile, setStockFile] = useState<File | null>(null)
  const [stockUploading, setStockUploading] = useState(false)
  const [stockResult, setStockResult] = useState<StockUpdateResult | null>(null)
  const stockInputRef = useRef<HTMLInputElement>(null)

  const handleStockDownload = () => {
    window.open("/api/admin/products/stock")
  }

  const handleStockFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      if (!selected.name.endsWith(".xlsx") && !selected.name.endsWith(".xls")) {
        toast.error(t("bulkExcelOnly"))
        return
      }
      setStockFile(selected)
      setStockResult(null)
    }
  }

  const handleStockUpload = async () => {
    if (!stockFile) return
    setStockUploading(true)
    setStockResult(null)
    try {
      const formData = new FormData()
      formData.append("file", stockFile)
      const res = await fetch("/api/admin/products/stock", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || t("bulkUploadFail"))
      }
      const data: StockUpdateResult = await res.json()
      setStockResult(data)
      if (data.updated > 0) toast.success(t("stockUpdateSuccess", { count: data.updated }))
      if (data.failed.length > 0) toast.error(t("bulkErrors", { count: data.failed.length }))
    } catch (err: any) {
      toast.error(err.message || t("bulkUploadError"))
    } finally {
      setStockUploading(false)
    }
  }

  const handleStockReset = () => {
    setStockFile(null)
    setStockResult(null)
    if (stockInputRef.current) stockInputRef.current.value = ""
  }

  // ── Image bulk upload state ──
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imageUploading, setImageUploading] = useState(false)
  const [imageProgress, setImageProgress] = useState("")
  const [imgDone, setImgDone] = useState(0)
  const [imgElapsed, setImgElapsed] = useState(0)

  // 업로드는 브라우저에서 돈다. 페이지를 벗어나면 그대로 끊긴다.
  useLeaveGuard(uploading || stockUploading || imageUploading, t("uploadLeaveWarning"))
  const [imageResult, setImageResult] = useState<ImageUploadResult | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (selected && selected.length > 0) {
      setImageFiles(Array.from(selected))
      setImageResult(null)
      setImageProgress("")
    }
  }

  const handleImageUpload = async () => {
    if (imageFiles.length === 0) return

    setImageUploading(true)
    setImageResult(null)
    setImgDone(0)
    setImgElapsed(0)
    const startedAt = Date.now()
    const timer = setInterval(() => setImgElapsed(Math.floor((Date.now() - startedAt) / 1000)), 1000)

    try {
      // Vercel 요청 본문 한도(4.5MB)를 넘지 않도록 나눠 보낸다.
      // 한 상품의 이미지는 순서·썸네일 때문에 반드시 같은 요청에 담아야 하므로
      // 상품코드 단위로 묶은 뒤 용량 기준으로 청크를 만든다.
      // Vercel 요청 본문 한도에 여유를 크게 둔다. 3MB 로도 413 이 났다.
      const MAX_CHUNK_BYTES = 1024 * 1024

      const byCode = new Map<string, File[]>()
      for (const f of imageFiles) {
        const base = f.name.replace(/\.[^.]+$/, "")
        const parts = base.split("_")
        const code = parts.length >= 2 && !isNaN(parseInt(parts[parts.length - 1], 10))
          ? parts.slice(0, -1).join("_")
          : base
        const arr = byCode.get(code) ?? []
        arr.push(f)
        byCode.set(code, arr)
      }

      const chunks: File[][] = []
      let current: File[] = []
      let currentBytes = 0
      for (const group of byCode.values()) {
        const groupBytes = group.reduce((sum, f) => sum + f.size, 0)
        if (current.length > 0 && currentBytes + groupBytes > MAX_CHUNK_BYTES) {
          chunks.push(current)
          current = []
          currentBytes = 0
        }
        current.push(...group)
        currentBytes += groupBytes
      }
      if (current.length > 0) chunks.push(current)

      const merged: ImageUploadResult = { success: 0, failed: [] }
      let sent = 0

      for (const chunk of chunks) {
        const formData = new FormData()
        for (const f of chunk) formData.append("files", f)
        // 같은 상품을 다시 올려도 이미지가 누적되지 않도록 교체 모드로 보낸다
        formData.append("mode", "replace")

        const res = await fetch("/api/products/bulk-images", {
          method: "POST",
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || t("bulkUploadFail"))
        }

        const data: ImageUploadResult = await res.json()
        merged.success += data.success
        merged.failed.push(...data.failed)
        sent += chunk.length
        setImgDone(sent)
      }

      setImageResult(merged)
      setImageProgress("")

      if (merged.success > 0) {
        toast.success(t("bulkImagesUploaded", { count: merged.success }))
      }
      if (merged.failed.length > 0) {
        toast.error(t("bulkErrors", { count: merged.failed.length }))
      }
    } catch (err: any) {
      toast.error(err.message || t("bulkImageUploadError"))
      setImageProgress("")
    } finally {
      clearInterval(timer)
      setImageUploading(false)
    }
  }

  const handleImageReset = () => {
    setImageFiles([])
    setImageResult(null)
    setImageProgress("")
    setImgDone(0)
    setImgElapsed(0)
    if (imageInputRef.current) imageInputRef.current.value = ""
  }

  return (
    <div className="space-y-4">
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-green-600" />
          <span className="font-medium">{t("bulkExcelUpload")}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleDownloadTemplate("adult")}>
            <Download className="mr-1 h-4 w-4" />
            성인복 템플릿
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleDownloadTemplate("kids")}>
            <Download className="mr-1 h-4 w-4" />
            아동복 템플릿
          </Button>

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-1 h-4 w-4" />
            {t("bulkSelectFile")}
          </Button>

          {file && (
            <>
              <span className="text-sm text-muted-foreground">{file.name}</span>
              <Button variant="ghost" size="sm" onClick={handleReset} className="h-6 w-6 p-0">
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {file && !result && (
          <div className="space-y-2">
            <Button size="sm" onClick={handleUpload} disabled={uploading} className="w-fit">
              {uploading ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  {t("bulkUploading")}
                </>
              ) : (
                t("bulkStartUpload")
              )}
            </Button>

            {uploading && progress && (
              <div className="space-y-1">
                <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-green-600 transition-[width] duration-300"
                    style={{
                      width: progress.total > 0
                        ? `${Math.min(100, Math.round((progress.done / progress.total) * 100))}%`
                        : "10%",
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {progress.label
                    ? progress.label
                    : t("bulkProgress", { done: progress.done, total: progress.total })}
                  {" · "}
                  {t("bulkElapsed", { seconds: elapsed })}
                </p>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="space-y-2 text-sm">
            {result.success > 0 && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {t("bulkProductSuccess", { count: result.success })}
                  {result.updated > 0 &&
                    ` (${t("bulkCreatedUpdated", { created: result.created, updated: result.updated })})`}
                </span>
              </div>
            )}
            {result.failed.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>{t("bulkErrorCount", { count: result.failed.length })}</span>
                </div>
                <ul className="ml-5 list-disc space-y-0.5 text-red-600">
                  {result.failed.map((f, i) => (
                    <li key={i}>
                      {f.row > 0 ? t("bulkRowError", { row: f.row, error: f.error }) : f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleReset}>
              {t("bulkReupload")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Stock Update */}
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-orange-600" />
          <span className="font-medium">{t("stockManagement")}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleStockDownload}>
            <Download className="mr-1 h-4 w-4" />
            {t("stockDownload")}
          </Button>

          <input
            ref={stockInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleStockFileChange}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => stockInputRef.current?.click()}
          >
            <Upload className="mr-1 h-4 w-4" />
            {t("stockSelectFile")}
          </Button>

          {stockFile && (
            <>
              <span className="text-sm text-muted-foreground">{stockFile.name}</span>
              <Button variant="ghost" size="sm" onClick={handleStockReset} className="h-6 w-6 p-0">
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground">{t("stockUploadHint")}</p>

        {stockFile && !stockResult && (
          <Button size="sm" onClick={handleStockUpload} disabled={stockUploading} className="w-fit">
            {stockUploading ? t("bulkUploading") : t("stockStartUpload")}
          </Button>
        )}

        {stockResult && (
          <div className="space-y-2 text-sm">
            {stockResult.updated > 0 && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>{t("stockUpdateSuccess", { count: stockResult.updated })}</span>
              </div>
            )}
            {stockResult.failed.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>{t("bulkErrorCount", { count: stockResult.failed.length })}</span>
                </div>
                <ul className="ml-5 list-disc space-y-0.5 text-red-600">
                  {stockResult.failed.map((f, i) => (
                    <li key={i}>
                      {f.row > 0 ? t("bulkRowError", { row: f.row, error: f.error }) : f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleStockReset}>
              {t("bulkReupload")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Image Bulk Upload */}
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2">
          <ImagePlus className="h-5 w-5 text-blue-600" />
          <span className="font-medium">{t("bulkImageUpload")}</span>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("bulkImageFileRule")}
          <br />{t("bulkImageThumbnailHint")}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageFileChange}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => imageInputRef.current?.click()}
          >
            <ImagePlus className="mr-1 h-4 w-4" />
            {t("bulkSelectImages")}
          </Button>

          {imageFiles.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">{t("bulkFilesSelected", { count: imageFiles.length })}</span>
              <Button variant="ghost" size="sm" onClick={handleImageReset} className="h-6 w-6 p-0">
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {imageFiles.length > 0 && !imageResult && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1 text-xs text-muted-foreground max-h-20 overflow-y-auto">
              {imageFiles.map((f, i) => (
                <span key={i} className="rounded bg-muted px-1.5 py-0.5">{f.name}</span>
              ))}
            </div>
            <Button size="sm" onClick={handleImageUpload} disabled={imageUploading} className="w-fit">
              {imageUploading ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  {t("bulkUploading")}
                </>
              ) : (
                t("bulkStartImageUpload")
              )}
            </Button>

            {imageUploading && (
              <div className="space-y-1">
                <div className="h-2 w-full max-w-md overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
                    style={{ width: `${Math.min(100, Math.round((imgDone / imageFiles.length) * 100))}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {t("bulkProgress", { done: imgDone, total: imageFiles.length })}
                  {" · "}
                  {t("bulkElapsed", { seconds: imgElapsed })}
                </p>
              </div>
            )}
          </div>
        )}

        {imageResult && (
          <div className="space-y-2 text-sm">
            {imageResult.success > 0 && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>{t("bulkImageSuccess", { count: imageResult.success })}</span>
              </div>
            )}
            {imageResult.failed.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>{t("bulkErrorCount", { count: imageResult.failed.length })}</span>
                </div>
                <ul className="ml-5 list-disc space-y-0.5 text-red-600">
                  {imageResult.failed.map((f, i) => (
                    <li key={i}>
                      {f.file}: {f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleImageReset}>
              {t("bulkReupload")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  )
}
