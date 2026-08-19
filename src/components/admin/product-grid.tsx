"use client"

import { createContext, useContext, useState } from "react"
import { Grid2X2, Grid3X3, LayoutGrid, Rows3, Image as ImageIcon, Images } from "lucide-react"
import { Button } from "@/components/ui/button"

const GRID_OPTIONS = [
  { cols: 3, icon: Rows3 },
  { cols: 4, icon: Grid2X2 },
  { cols: 6, icon: Grid3X3 },
  { cols: 8, icon: LayoutGrid },
] as const

/**
 * 카드 안의 이미지 표시 방식을 그리드 전체가 공유한다.
 * 카드는 서버 컴포넌트에서 렌더되므로 상태를 내려보낼 수 없어 컨텍스트를 쓴다.
 */
const ShowAllImagesContext = createContext(false)

export function useShowAllImages() {
  return useContext(ShowAllImagesContext)
}

export function ProductGrid({
  children,
  allImagesLabel,
  mainImageLabel,
}: {
  children: React.ReactNode
  allImagesLabel: string
  mainImageLabel: string
}) {
  const [cols, setCols] = useState(4)
  const [showAll, setShowAll] = useState(false)

  return (
    <ShowAllImagesContext.Provider value={showAll}>
      <div>
        <div className="mb-3 flex items-center justify-end gap-1">
          <Button
            variant={showAll ? "default" : "ghost"}
            size="sm"
            className="mr-2 h-8 gap-1.5 px-2.5"
            onClick={() => setShowAll((v) => !v)}
            title={showAll ? mainImageLabel : allImagesLabel}
          >
            {showAll ? <Images className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
            <span className="text-xs font-normal">{showAll ? allImagesLabel : mainImageLabel}</span>
          </Button>
          {GRID_OPTIONS.map((opt) => (
            <Button
              key={opt.cols}
              variant={cols === opt.cols ? "default" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setCols(opt.cols)}
              title={`${opt.cols}열`}
            >
              <opt.icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridAutoRows: "1fr",
          }}
        >
          {children}
        </div>
      </div>
    </ShowAllImagesContext.Provider>
  )
}
