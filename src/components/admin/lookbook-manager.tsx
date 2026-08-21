"use client"

import { useRef, useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, Upload, Trash2, Loader2, Eye, EyeOff } from "lucide-react"
import { DropZone } from "@/components/ui/drop-zone"

interface Item {
  id: string
  title: string
  url: string
  format: string | null
  bytes: number
  isActive: boolean
}

function humanSize(bytes: number): string {
  if (!bytes) return ""
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * 룩북 PDF 관리. 파일은 브라우저에서 Cloudinary 로 직접 올린다.
 * 서버(Vercel)는 4.5MB 한도가 있어 수십 MB 룩북을 거치지 못한다.
 */
export function LookbookManager({ initial }: { initial: Item[] }) {
  const t = useTranslations("admin")
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function onDrop(files: File[]) {
    if (!files[0] || !fileRef.current) return
    const dt = new DataTransfer()
    dt.items.add(files[0])
    fileRef.current.files = dt.files
    // 파일명 표시 갱신을 위해 강제 리렌더
    setTitle((t) => t)
    handleUpload(files[0])
  }

  async function handleUpload(dropped?: File) {
    const file = dropped ?? fileRef.current?.files?.[0]
    if (!title.trim()) return toast.error(t("lookbookTitleRequired"))
    if (!file) return toast.error(t("lookbookFileRequired"))
    if (file.type !== "application/pdf") return toast.error(t("lookbookPdfOnly"))

    setBusy(true)
    setProgress(0)
    try {
      // 1) 서버에서 서명 받기
      const signRes = await fetch("/api/admin/lookbooks/sign", { method: "POST" })
      if (!signRes.ok) throw new Error()
      const { signature, timestamp, apiKey, cloudName, folder } = await signRes.json()

      // 2) 브라우저 → Cloudinary 직접 업로드(raw)
      const fd = new FormData()
      fd.append("file", file)
      fd.append("api_key", apiKey)
      fd.append("timestamp", String(timestamp))
      fd.append("signature", signature)
      fd.append("folder", folder)

      const uploaded = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () =>
          xhr.status < 300 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(xhr.responseText))
        xhr.onerror = () => reject(new Error("network"))
        xhr.send(fd)
      })

      // 3) 레코드 생성
      const createRes = await fetch("/api/admin/lookbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          publicId: uploaded.public_id,
          url: uploaded.secure_url,
          format: uploaded.format || "pdf",
          bytes: uploaded.bytes || file.size,
        }),
      })
      if (!createRes.ok) throw new Error((await createRes.json()).error)

      toast.success(t("lookbookUploaded"))
      setTitle("")
      if (fileRef.current) fileRef.current.value = ""
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || t("lookbookUploadFail"))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  async function toggleActive(item: Item) {
    const res = await fetch(`/api/admin/lookbooks/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    })
    if (res.ok) router.refresh()
    else toast.error(t("error"))
  }

  async function remove(item: Item) {
    if (!confirm(t("lookbookDeleteConfirm"))) return
    const res = await fetch(`/api/admin/lookbooks/${item.id}`, { method: "DELETE" })
    if (res.ok) {
      toast.success(t("lookbookDeleted"))
      router.refresh()
    } else toast.error(t("error"))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-4">
         <DropZone accept="application/pdf,.pdf" disabled={busy} onFiles={onDrop} overlayText={t("lookbookDropHere")} className="space-y-3 p-2">
          <p className="text-sm font-medium">{t("lookbookUploadNew")}</p>
          <Input
            placeholder={t("lookbookTitlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden" />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              <FileText className="mr-1 h-4 w-4" />
              {t("lookbookSelectFile")}
            </Button>
            <span className="text-sm text-muted-foreground">
              {fileRef.current?.files?.[0]?.name || t("lookbookNoFile")}
            </span>
            <Button size="sm" onClick={() => handleUpload()} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
              {progress !== null ? `${progress}%` : t("lookbookUpload")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("lookbookHint")}</p>
         </DropZone>
        </CardContent>
      </Card>

      {initial.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{t("lookbookEmpty")}</CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {initial.map((lb) => (
            <Card key={lb.id} className={lb.isActive ? "" : "opacity-60"}>
              <CardContent className="flex items-center gap-4 py-3">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{lb.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {(lb.format || "PDF").toUpperCase()}
                    {lb.bytes ? ` · ${humanSize(lb.bytes)}` : ""}
                    {!lb.isActive && ` · ${t("lookbookHidden")}`}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => toggleActive(lb)} title={t("lookbookToggle")}>
                  {lb.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(lb)} title={t("lookbookDelete")}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
