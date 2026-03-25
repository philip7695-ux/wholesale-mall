"use client"

import { useState, useEffect } from "react"
import { Grid2X2, Grid3X3, LayoutGrid, Rows3 } from "lucide-react"

const STORAGE_KEY = "shop-grid-cols"

const GRID_OPTIONS = [
  { cols: 2, icon: Rows3, label: "2열" },
  { cols: 3, icon: Grid2X2, label: "3열" },
  { cols: 4, icon: Grid3X3, label: "4열" },
  { cols: 5, icon: LayoutGrid, label: "5열" },
] as const

export function ShopProductGrid({ children }: { children: React.ReactNode }) {
  const [cols, setCols] = useState(4)

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
      <div className="flex items-center justify-end gap-1.5 mb-6">
        {GRID_OPTIONS.map((opt) => (
          <button
            key={opt.cols}
            className={`flex h-8 w-8 items-center justify-center rounded transition-colors ${
              cols === opt.cols
                ? "bg-[#1A1A1A] text-white"
                : "text-gray-300 hover:text-gray-500"
            }`}
            onClick={() => handleChange(opt.cols)}
            title={opt.label}
          >
            <opt.icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      <div
        className="grid gap-x-5 gap-y-10"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
