"use client"

import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("error")

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <h2 className="text-xl font-bold">{t("title")}</h2>
      <p className="text-muted-foreground">{t("description")}</p>
      <Button onClick={() => reset()}>{t("retry")}</Button>
    </div>
  )
}
