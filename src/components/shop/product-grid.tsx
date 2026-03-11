"use client"

import { useState, useEffect } from "react"
import { Grid2X2, Grid3X3, LayoutGrid, Rows3 } from "lucide-react"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "shop-grid-cols"

const GRID_OPTIONS = [
  { cols: 2, icon: Rows3, label: "2열" },
  { cols: 3, icon: Grid2X2, label: "3열" },
  { cols: 4, icon: Grid3X3, label: "4열" },
  { cols: 5, icon: LayoutGrid, label: "5열" },
] as const

export function ShopProductGrid({ children }: { children: React.ReactNode }) {
  const [cols, setCols] = useState(3)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const n = parseInt(saved)
      if (GRID_OPTIONS.some((o) => o.cols === n)) setCols(n)
    }
  }, [])

  function handleChange(n: number) {
    setCols(n)
    localStorage.setItem(STORAGE_KEY, String(n))
  }

  return (
    <div>
      <div className="flex items-center justify-end gap-1 mb-3">
        {GRID_OPTIONS.map((opt) => (
          <Button
            key={opt.cols}
            variant={cols === opt.cols ? "default" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => handleChange(opt.cols)}
            title={opt.label}
          >
            <opt.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
