"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { toast } from "sonner"
import {
  Grid2X2,
  Grid3X3,
  LayoutGrid,
  Rows3,
  Image as ImageIcon,
  Images,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  X,
  Tag,
  Ban,
} from "lucide-react"
import { Button } from "@/components/ui/button"

const GRID_OPTIONS = [
  { cols: 3, icon: Rows3 },
  { cols: 4, icon: Grid2X2 },
  { cols: 6, icon: Grid3X3 },
  { cols: 8, icon: LayoutGrid },
] as const

const STORE_KEY = "admin.productGrid"

/**
 * 카드 안에서 쓰는 상태. 카드는 서버 컴포넌트에서 렌더되므로
 * props 로 내려보낼 수 없어 컨텍스트를 쓴다.
 */
interface GridState {
  showAll: boolean
  selected: Set<string>
  toggle: (id: string) => void
}
const GridContext = createContext<GridState>({
  showAll: false,
  selected: new Set(),
  toggle: () => {},
})

export function useShowAllImages() {
  return useContext(GridContext).showAll
}
export function useProductSelection() {
  const { selected, toggle } = useContext(GridContext)
  return { selected, toggle }
}

export function ProductGrid({
  children,
  allImagesLabel,
  mainImageLabel,
  labels,
}: {
  children: React.ReactNode
  allImagesLabel: string
  mainImageLabel: string
  labels: {
    selected: string
    activate: string
    deactivate: string
    delete: string
    clear: string
    special: string
    unspecial: string
    deleteConfirm: string
    orderedWarning: string
    done: string
    failed: string
  }
}) {
  const router = useRouter()
  const [cols, setCols] = useState(4)
  const [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  // 표시 형식은 기억한다. 삭제나 새로고침 때마다 기본값으로 돌아가면
  // 8열로 훑던 작업이 계속 끊긴다.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "{}")
      if (GRID_OPTIONS.some((o) => o.cols === saved.cols)) setCols(saved.cols)
      if (typeof saved.showAll === "boolean") setShowAll(saved.showAll)
    } catch {
      // 저장값이 깨졌으면 기본값으로 둔다
    }
  }, [])

  function remember(next: { cols?: number; showAll?: boolean }) {
    const value = { cols, showAll, ...next }
    if (next.cols !== undefined) setCols(next.cols)
    if (next.showAll !== undefined) setShowAll(next.showAll)
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(value))
    } catch {
      // 저장에 실패해도 이번 화면에서는 그대로 쓴다
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function run(
    action: "activate" | "deactivate" | "delete" | "special" | "unspecial",
    confirmOrdered = false,
  ) {
    const ids = [...selected]
    if (!ids.length) return
    if (action === "delete" && !confirmOrdered && !confirm(labels.deleteConfirm)) return

    setBusy(true)
    try {
      const res = await fetch("/api/admin/products/bulk-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, confirmOrdered }),
      })
      const data = await res.json()
      // 주문된 적 있는 상품이 섞이면 서버가 되묻는다
      if (res.status === 409 && data.needsConfirm) {
        setBusy(false)
        if (confirm(labels.orderedWarning.replace("{count}", String(data.ordered)))) {
          await run(action, true)
        }
        return
      }
      if (!res.ok) throw new Error(data.error)
      toast.success(labels.done.replace("{count}", String(data.count)))
      setSelected(new Set())
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || labels.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <GridContext.Provider value={{ showAll, selected, toggle }}>
      <div>
        <div className="mb-3 flex items-center justify-end gap-1">
          <Button
            variant={showAll ? "default" : "ghost"}
            size="sm"
            className="mr-2 h-8 gap-1.5 px-2.5"
            onClick={() => remember({ showAll: !showAll })}
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
              onClick={() => remember({ cols: opt.cols })}
              title={`${opt.cols}열`}
            >
              <opt.icon className="h-4 w-4" />
            </Button>
          ))}
        </div>

        {selected.size > 0 && (
          <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 shadow-sm">
            <span className="px-1 text-sm font-medium">
              {labels.selected.replace("{count}", String(selected.size))}
            </span>
            <Button size="sm" variant="outline" onClick={() => run("activate")} disabled={busy}>
              <Eye className="mr-1 h-3 w-3" />
              {labels.activate}
            </Button>
            <Button size="sm" variant="outline" onClick={() => run("deactivate")} disabled={busy}>
              <EyeOff className="mr-1 h-3 w-3" />
              {labels.deactivate}
            </Button>
            <Button size="sm" variant="outline" onClick={() => run("special")} disabled={busy}>
              <Tag className="mr-1 h-3 w-3" />
              {labels.special}
            </Button>
            <Button size="sm" variant="outline" onClick={() => run("unspecial")} disabled={busy}>
              <Ban className="mr-1 h-3 w-3" />
              {labels.unspecial}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => run("delete")} disabled={busy}>
              {busy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1 h-3 w-3" />}
              {labels.delete}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={busy}>
              <X className="mr-1 h-3 w-3" />
              {labels.clear}
            </Button>
          </div>
        )}

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
    </GridContext.Provider>
  )
}
