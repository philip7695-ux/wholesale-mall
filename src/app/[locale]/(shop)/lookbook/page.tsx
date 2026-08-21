"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useTranslations } from "next-intl"
import { FileText, Download } from "lucide-react"

interface Lookbook {
  id: string
  title: string
  url: string
  format: string | null
  bytes: number
  createdAt: string
}

/** 파일 크기를 사람이 읽는 단위로 */
function humanSize(bytes: number): string {
  if (!bytes) return ""
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export default function LookbookPage() {
  const t = useTranslations("lookbook")
  const [items, setItems] = useState<Lookbook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch("/api/lookbooks")
      .then(async (r) => {
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-light tracking-tight">{t("title")}</h1>
      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>

      {loading ? (
        <p className="py-10 text-center text-muted-foreground">{t("loading")}</p>
      ) : error ? (
        <p className="py-10 text-center text-muted-foreground">{t("loadError")}</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">{t("empty")}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((lb) => (
            <Card key={lb.id}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-muted">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{lb.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {(lb.format || "PDF").toUpperCase()}
                    {lb.bytes ? ` · ${humanSize(lb.bytes)}` : ""}
                  </p>
                </div>
                <a href={`/api/lookbooks/${lb.id}/download`}>
                  <Button size="sm" variant="outline">
                    <Download className="mr-1 h-4 w-4" />
                    {t("download")}
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
