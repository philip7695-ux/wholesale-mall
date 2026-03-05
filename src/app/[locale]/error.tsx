"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("error")

  useEffect(() => {
    console.error("[PageError]", error.message, "digest:", error.digest)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8">
      <h2 className="text-xl font-bold">{t("title")}</h2>
      <p className="text-muted-foreground">{t("description")}</p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-2 rounded">
          digest: {error.digest}
        </p>
      )}
      <Button onClick={() => reset()}>{t("retry")}</Button>
    </div>
  )
}
