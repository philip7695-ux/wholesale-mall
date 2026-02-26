"use client"

import { Button } from "@/components/ui/button"

export default function Error({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <h2 className="text-xl font-bold">일시적인 오류가 발생했습니다</h2>
      <p className="text-muted-foreground">잠시 후 다시 시도해주세요.</p>
      <Button onClick={() => reset()}>다시 시도</Button>
    </div>
  )
}
