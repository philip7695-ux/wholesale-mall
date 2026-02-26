"use client"

import { useState, useRef } from "react"
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
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<UploadResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = () => {
    window.open("/api/products/template", "_blank")
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      if (!selected.name.endsWith(".xlsx") && !selected.name.endsWith(".xls")) {
        toast.error("엑셀 파일(.xlsx, .xls)만 업로드 가능합니다.")
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
        throw new Error(err.error || "업로드 실패")
      }

      const data: UploadResult = await res.json()
      setResult(data)

      if (data.success > 0) {
        toast.success(`${data.success}개 상품이 등록되었습니다.`)
      }
      if (data.failed.length > 0) {
        toast.error(`${data.failed.length}건의 오류가 있습니다.`)
      }
    } catch (err: any) {
      toast.error(err.message || "업로드 중 오류가 발생했습니다.")
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

      setImageProgress(`업로드 중... (${imageFiles.length}개 파일)`)

      const res = await fetch("/api/products/bulk-images", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "업로드 실패")
      }

      const data: ImageUploadResult = await res.json()
      setImageResult(data)
      setImageProgress("")

      if (data.success > 0) {
        toast.success(`${data.success}개 이미지가 업로드되었습니다.`)
      }
      if (data.failed.length > 0) {
        toast.error(`${data.failed.length}건의 오류가 있습니다.`)
      }
    } catch (err: any) {
      toast.error(err.message || "이미지 업로드 중 오류가 발생했습니다.")
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
          <span className="font-medium">엑셀 대량 등록</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
            <Download className="mr-1 h-4 w-4" />
            템플릿 다운로드
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
            파일 선택
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
            {uploading ? "업로드 중..." : "대량 등록 시작"}
          </Button>
        )}

        {result && (
          <div className="space-y-2 text-sm">
            {result.success > 0 && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>{result.success}개 상품 등록 성공</span>
              </div>
            )}
            {result.failed.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>{result.failed.length}건 오류</span>
                </div>
                <ul className="ml-5 list-disc space-y-0.5 text-red-600">
                  {result.failed.map((f, i) => (
                    <li key={i}>
                      {f.row > 0 ? `행 ${f.row}: ` : ""}{f.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleReset}>
              다시 업로드
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
          <span className="font-medium">이미지 대량 업로드</span>
        </div>

        <p className="text-xs text-muted-foreground">
          파일명 규칙: <code className="rounded bg-muted px-1">상품코드_순서.확장자</code> (예: ST001_1.jpg, ST001_2.jpg, AB02_1.png)
          <br />순서 1번이 대표 이미지(썸네일)로 설정됩니다.
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
            이미지 선택
          </Button>

          {imageFiles.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">{imageFiles.length}개 파일 선택됨</span>
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
              {imageUploading ? imageProgress || "업로드 중..." : "이미지 대량 업로드 시작"}
            </Button>
          </div>
        )}

        {imageResult && (
          <div className="space-y-2 text-sm">
            {imageResult.success > 0 && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>{imageResult.success}개 이미지 업로드 성공</span>
              </div>
            )}
            {imageResult.failed.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>{imageResult.failed.length}건 오류</span>
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
              다시 업로드
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  )
}
