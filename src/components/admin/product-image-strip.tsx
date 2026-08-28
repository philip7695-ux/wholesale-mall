"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { toast } from "sonner"
import { X, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useShowAllImages } from "@/components/admin/product-grid"

/**
 * 상품 카드의 이미지 영역.
 *
 * '전체 사진' 모드에서는 등록된 사진을 순서대로 나란히 보여준다.
 * 누끼컷은 배경이 흰색이라, 회색 바탕 위에 늘어놓으면 누끼가 두 장
 * 올라간 상품이 흰 사각형 두 개로 바로 드러난다. 208개를 하나씩
 * 열어보지 않고 목록에서 훑어내기 위한 것이다.
 *
 * 각 장의 X 버튼으로 그 자리에서 지울 수 있다(추가는 편집 화면에서).
 */
export function ProductImageStrip({
  productId,
  images,
  thumbnail,
  name,
  isActive,
  activeLabel,
  inactiveLabel,
  noImageLabel,
  deleteConfirmLabel,
  deleteFailLabel,
}: {
  productId: string
  images: string[]
  thumbnail?: string | null
  name: string
  isActive: boolean
  activeLabel: string
  inactiveLabel: string
  noImageLabel: string
  deleteConfirmLabel: string
  deleteFailLabel: string
}) {
  const showAll = useShowAllImages()
  const router = useRouter()
  const [removing, setRemoving] = useState<string | null>(null)

  async function removeImage(e: React.MouseEvent, src: string) {
    // 카드 전체가 편집 링크라 버튼 클릭이 페이지 이동으로 번지지 않게 막는다
    e.preventDefault()
    e.stopPropagation()
    if (removing) return
    if (!confirm(deleteConfirmLabel)) return
    setRemoving(src)
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeImage: src }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      toast.error(deleteFailLabel)
    } finally {
      setRemoving(null)
    }
  }

  const statusBadge = (
    <Badge variant={isActive ? "default" : "secondary"} className="absolute right-2 top-2 z-10">
      {isActive ? activeLabel : inactiveLabel}
    </Badge>
  )

  if (!images.length && !thumbnail) {
    return (
      <div className="relative w-full rounded-t-lg bg-muted" style={{ paddingBottom: "100%" }}>
        <span className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          {noImageLabel}
        </span>
        {statusBadge}
      </div>
    )
  }

  if (!showAll) {
    return (
      <div className="relative w-full overflow-hidden rounded-t-lg" style={{ paddingBottom: "100%" }}>
        <img
          src={thumbnail || images[0]}
          alt={name}
          className="absolute inset-0 h-full w-full object-contain"
        />
        {statusBadge}
      </div>
    )
  }

  // 한 상품에 최대 4장이므로 2x2 로 놓는다. 가로로 늘어놓으면 장당 폭이
  // 좁아 배경색 구분이 어렵고 카드가 납작해진다.
  return (
    <div className="relative rounded-t-lg bg-gray-100 p-1">
      {statusBadge}
      <div className="grid grid-cols-2 gap-1">
        {images.map((src, i) => (
          // paddingBottom 은 자기 너비 기준이므로 100% 면 정사각형이 된다
          <div key={`${i}-${src}`} className="group relative overflow-hidden bg-white" style={{ paddingBottom: "100%" }}>
            <img
              src={src}
              alt={`${name} ${i + 1}`}
              className="absolute inset-0 h-full w-full object-contain"
            />
            <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 text-[10px] leading-tight text-white">
              {i + 1}
            </span>
            <button
              type="button"
              onClick={(e) => removeImage(e, src)}
              disabled={removing !== null}
              aria-label={`${name} ${i + 1} 삭제`}
              className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity hover:bg-red-600 focus-visible:opacity-100 group-hover:opacity-100"
            >
              {removing === src ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
