"use client"

import { Badge } from "@/components/ui/badge"
import { useShowAllImages } from "@/components/admin/product-grid"

/**
 * 상품 카드의 이미지 영역.
 *
 * '전체 사진' 모드에서는 등록된 사진을 순서대로 나란히 보여준다.
 * 누끼컷은 배경이 흰색이라, 회색 바탕 위에 늘어놓으면 누끼가 두 장
 * 올라간 상품이 흰 사각형 두 개로 바로 드러난다. 208개를 하나씩
 * 열어보지 않고 목록에서 훑어내기 위한 것이다.
 */
export function ProductImageStrip({
  images,
  thumbnail,
  name,
  isActive,
  activeLabel,
  inactiveLabel,
  noImageLabel,
}: {
  images: string[]
  thumbnail?: string | null
  name: string
  isActive: boolean
  activeLabel: string
  inactiveLabel: string
  noImageLabel: string
}) {
  const showAll = useShowAllImages()
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
          <div key={`${i}-${src}`} className="relative overflow-hidden bg-white" style={{ paddingBottom: "100%" }}>
            <img
              src={src}
              alt={`${name} ${i + 1}`}
              className="absolute inset-0 h-full w-full object-contain"
            />
            <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 text-[10px] leading-tight text-white">
              {i + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
