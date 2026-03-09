"use client"

import { useTranslations } from "next-intl"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("admin")
  const te = useTranslations("error")

  console.error("[AdminError]", error.message, "digest:", error.digest)

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8">
      <h2 className="text-xl font-bold text-destructive">{t("adminErrorTitle")}</h2>
      <p className="text-sm text-muted-foreground font-mono bg-muted px-3 py-2 rounded">
        digest: {error.digest ?? t("digestNone")}
      </p>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm"
      >
        {te("retry")}
      </button>
    </div>
  )
}
