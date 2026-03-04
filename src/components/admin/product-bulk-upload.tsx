"use client"

import { useState, useRef } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Download, Upload, FileSpreadsheet, ImagePlus, X, CheckCircle2, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface UploadResult {
  success: number
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
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = () => {
    window.open("/api/products/template")
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

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/products/bulk", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || t("bulkUploadFail"))
      }

      const data: UploadResult = await res.json()
      setResult(data)

      if (data.success > 0) {
        toast.success(t("bulkProductsRegistered", { count: data.success }))
      }
      if (data.failed.length > 0) {
        toast.error(t("bulkErrors", { count: data.failed.length }))
      }
    } catch (err: any) {
      toast.error(err.message || t("bulkUploadError"))
    } finally {
      setUploading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setResult(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  // ── Image bulk upload state ──
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imageUploading, setImageUploading] = useState(false)
  const [imageProgress, setImageProgress] = useState("")
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
    setImageProgress(`0/${imageFiles.length}`)

    try {
      const formData = new FormData()
      for (const f of imageFiles) {
        formData.append("files", f)
      }

      setImageProgress(t("bulkImageUploading", { count: imageFiles.length }))

      const res = await fetch("/api/products/bulk-images", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || t("bulkUploadFail"))
      }

      const data: ImageUploadResult = await res.json()
      setImageResult(data)
      setImageProgress("")

      if (data.success > 0) {
        toast.success(t("bulkImagesUploaded", { count: data.success }))
      }
      if (data.failed.length > 0) {
        toast.error(t("bulkErrors", { count: data.failed.length }))
      }
    } catch (err: any) {
      toast.error(err.message || t("bulkImageUploadError"))
      setImageProgress("")
    } finally {
      setImageUploading(false)
    }
  }

  const handleImageReset = () => {
    setImageFiles([])
    setImageResult(null)
    setImageProgress("")
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
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="mr-1 h-4 w-4" />
            {t("bulkDownloadTemplate")}
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
          <Button size="sm" onClick={handleUpload} disabled={uploading} className="w-fit">
            {uploading ? t("bulkUploading") : t("bulkStartUpload")}
          </Button>
        )}

        {result && (
          <div className="space-y-2 text-sm">
            {result.success > 0 && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>{t("bulkProductSuccess", { count: result.success })}</span>
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
              {imageUploading ? imageProgress || t("bulkUploading") : t("bulkStartImageUpload")}
            </Button>
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
