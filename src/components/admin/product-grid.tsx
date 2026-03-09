"use client"

import { useState } from "react"
import { Grid2X2, Grid3X3, LayoutGrid, Rows3 } from "lucide-react"
import { Button } from "@/components/ui/button"

const GRID_OPTIONS = [
  { cols: 3, icon: Rows3 },
  { cols: 4, icon: Grid2X2 },
  { cols: 6, icon: Grid3X3 },
  { cols: 8, icon: LayoutGrid },
] as const

export function ProductGrid({ children }: { children: React.ReactNode }) {
  const [cols, setCols] = useState(4)

  return (
    <div>
      <div className="flex items-center justify-end gap-1 mb-3">
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
  )
}
