"use client"

import { useRef, useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Send, CheckCircle2, Upload, AlertTriangle } from "lucide-react"
import { formatPrice } from "@/lib/utils"
import { DropZone } from "@/components/ui/drop-zone"
import { sortSizeNames } from "@/lib/product-sizes"

export interface RevisionItem {
  id: string
  productCode: string | null
  productName: string
  colorName: string
  sizeName: string
  quantity: number
  orderedQuantity: number
  price: number
  /** 관리자에게만 내려준다. 창고 확인 전 참고용 */
  stock?: number
}

interface Row {
  key: string
  productCode: string | null
  productName: string
  colorName: string
  firstOfProduct: boolean
  productRowSpan: number
  cells: Record<string, RevisionItem>
}

/**
 * 확정 전 주문의 수량을 고치는 표.
 *
 * 장바구니와 같은 오더시트 형태다. 품번 × 컬러가 세로, 사이즈가 가로로
 * 펼쳐진다. 창고에서 온 답을 옮겨 적을 때 한 스타일이 한 줄에 모여 있어야
 * 빠르다.
 *
 *   관리자 - 수량을 자유롭게 고치고 바이어에게 넘기거나 확정한다
 *   바이어 - 처음 주문한 수량 안에서만 줄이고 관리자에게 돌려보낸다
 *
 * 칸 아래 작은 글씨로 깎이기 전 수량과(관리자는) 재고를 함께 보여준다.
 * 무엇이 얼마나 줄었는지 드러나야 양쪽이 같은 것을 보고 이야기한다.
 */
export function OrderRevisionTable({
  orderId,
  items,
  isAdmin,
  canEdit,
  locale,
  rate,
}: {
  orderId: string
  items: RevisionItem[]
  isAdmin: boolean
  canEdit: boolean
  // 서버 컴포넌트에서도 쓰이므로 포맷 함수를 넘겨받을 수 없다.
  // 함수는 클라이언트 컴포넌트 경계를 넘지 못한다.
  locale: string
  rate?: number
}) {
  const router = useRouter()
  const t = useTranslations("order")
  const tc = useTranslations("common")
  const [draft, setDraft] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, String(i.quantity)])),
  )
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // 창고 회신에서 걸린 문제들. 토스트는 사라지지만 이건 손볼 때까지 남는다.
  const [sheetIssues, setSheetIssues] = useState<{
    unmatched: { label: string; qty: number }[]
    strayColumns: string[]
    missing: string[]
  } | null>(null)

  const fp = (amount: number) => formatPrice(amount, locale, rate)
  const qtyOf = (item: RevisionItem) => Number(draft[item.id]) || 0

  const changed = items.some((i) => Number(draft[i.id]) !== i.quantity)
  const total = items.reduce((s, i) => s + i.price * qtyOf(i), 0)
  const totalQty = items.reduce((s, i) => s + qtyOf(i), 0)

  const sizeNames = sortSizeNames([...new Set(items.map((i) => i.sizeName))])

  // 품번 + 컬러로 줄을 만든다. 같은 품번이 이어지면 품번은 첫 줄에만 적는다.
  const rows: Row[] = []
  {
    const byProduct = new Map<string, Map<string, Row>>()
    for (const item of items) {
      const pKey = `${item.productCode ?? ""}|${item.productName}`
      if (!byProduct.has(pKey)) byProduct.set(pKey, new Map())
      const colors = byProduct.get(pKey)!
      if (!colors.has(item.colorName)) {
        colors.set(item.colorName, {
          key: `${pKey}|${item.colorName}`,
          productCode: item.productCode,
          productName: item.productName,
          colorName: item.colorName,
          firstOfProduct: false,
          productRowSpan: 0,
          cells: {},
        })
      }
      colors.get(item.colorName)!.cells[item.sizeName] = item
    }
    for (const colors of byProduct.values()) {
      const list = [...colors.values()]
      list.forEach((r, idx) => {
        r.firstOfProduct = idx === 0
        r.productRowSpan = list.length
      })
      rows.push(...list)
    }
  }

  const columnTotals: Record<string, number> = {}
  for (const name of sizeNames) {
    columnTotals[name] = rows.reduce(
      (s, r) => s + (r.cells[name] ? qtyOf(r.cells[name]) : 0),
      0,
    )
  }

  async function submit(next?: "STOCK_CHECKING" | "BUYER_REVIEW") {
    setBusy(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ id: i.id, quantity: qtyOf(i) })),
          next,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(next ? t("revisionSent") : t("revisionSaved"))
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || t("revisionFailed"))
    } finally {
      setBusy(false)
    }
  }

  /**
   * 창고가 채워 보낸 발주서를 읽어 표에 채운다.
   *
   * 바로 저장하지 않는다. 표에 넣어두고 관리자가 눈으로 확인한 뒤
   * 저장 버튼을 누른다. 남이 만진 파일의 오타가 그대로 반영되면 곤란하다.
   */
  async function importSheet(file: File) {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch(`/api/orders/${orderId}/warehouse-sheet`, {
        method: "POST",
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      if (data.changes.length === 0) {
        toast.info(t("sheetImportNoChange"))
      } else {
        setDraft((d) => {
          const next = { ...d }
          for (const c of data.changes) next[c.itemId] = String(c.to)
          return next
        })
        toast.success(t("sheetImportApplied", { count: data.changes.length }))
      }

      // 창고가 주문에 없는 상품을 끼워 넣었거나 열을 새로 만들었을 수 있다.
      // 토스트로 흘려보내면 못 보고 지나친다. 표 위에 남겨 둔다.
      const issues = {
        unmatched: data.unmatched ?? [],
        strayColumns: data.strayColumns ?? [],
        missing: data.missing ?? [],
      }
      const any =
        issues.unmatched.length || issues.strayColumns.length || issues.missing.length
      setSheetIssues(any ? issues : null)
    } catch (e: any) {
      toast.error(e?.message || t("sheetImportFailed"))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function confirm() {
    if (!window.confirm(t("confirmOrderWarning"))) return
    setBusy(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/confirm`, { method: "POST" })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(t("orderConfirmed"))
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || t("revisionFailed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {sheetIssues && (
        <div className="rounded-lg border border-amber-400/60 bg-amber-50 p-3 text-sm dark:bg-amber-950/20">
          <p className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            {t("sheetIssuesTitle")}
          </p>
          <ul className="mt-1.5 space-y-1 text-amber-800 dark:text-amber-200">
            {sheetIssues.unmatched.length > 0 && (
              <li>
                <span className="font-medium">{t("sheetIssueNotInOrder")}</span>{" "}
                {sheetIssues.unmatched.map((u) => `${u.label} (${u.qty})`).join(", ")}
              </li>
            )}
            {sheetIssues.strayColumns.length > 0 && (
              <li>
                <span className="font-medium">{t("sheetIssueStrayColumn")}</span>{" "}
                {sheetIssues.strayColumns.join(", ")}
              </li>
            )}
            {sheetIssues.missing.length > 0 && (
              <li>
                <span className="font-medium">{t("sheetIssueMissing")}</span>{" "}
                {sheetIssues.missing.join(", ")}
              </li>
            )}
          </ul>
          <p className="mt-1.5 text-xs text-amber-700/80 dark:text-amber-300/80">
            {t("sheetIssuesHint")}
          </p>
        </div>
      )}

      <DropZone
        accept=".xlsx,.xls"
        disabled={busy || !isAdmin || !canEdit}
        onFiles={(files) => files[0] && importSheet(files[0])}
        overlayText={t("sheetImportDrop")}
        className="overflow-x-auto rounded-lg border"
      >
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
              <th
                rowSpan={2}
                className="sticky left-0 z-20 min-w-[130px] bg-muted/50 px-3 py-2 text-left"
              >
                {t("styleNo")}
              </th>
              <th
                rowSpan={2}
                className="sticky left-[130px] z-20 min-w-[100px] border-r bg-muted/50 px-3 py-2 text-left"
              >
                {t("color")}
              </th>
              <th colSpan={sizeNames.length} className="border-b px-2 py-1.5 text-left">
                {t("size")}
              </th>
              <th rowSpan={2} className="border-l px-3 py-2 text-right">
                {t("grandQty")}
              </th>
              <th rowSpan={2} className="px-3 py-2 text-right">
                {t("unitPrice")}
              </th>
              <th rowSpan={2} className="px-3 py-2 text-right">
                {t("amount")}
              </th>
            </tr>
            <tr className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
              {sizeNames.map((name) => (
                <th key={name} className="min-w-[64px] px-1 py-1.5 text-center">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowItems = Object.values(row.cells)
              const rowQty = rowItems.reduce((s, i) => s + qtyOf(i), 0)
              const rowAmount = rowItems.reduce((s, i) => s + i.price * qtyOf(i), 0)
              const prices = rowItems.map((i) => i.price)
              const pMin = Math.min(...prices)
              const pMax = Math.max(...prices)
              return (
                <tr
                  key={row.key}
                  className={`border-b last:border-0 ${row.firstOfProduct ? "border-t-2 border-t-muted" : ""}`}
                >
                  {row.firstOfProduct && (
                    <td
                      rowSpan={row.productRowSpan}
                      className="sticky left-0 z-10 bg-background px-3 py-1.5 align-top"
                    >
                      <p className="whitespace-nowrap font-mono font-medium">
                        {row.productCode || "-"}
                      </p>
                      <p className="line-clamp-2 text-xs text-muted-foreground">
                        {row.productName}
                      </p>
                    </td>
                  )}
                  <td className="sticky left-[130px] z-10 whitespace-nowrap border-r bg-background px-3 py-1.5">
                    {row.colorName}
                  </td>
                  {sizeNames.map((name) => {
                    const item = row.cells[name]
                    // 이 스타일에 없는 사이즈는 막는다
                    if (!item) {
                      return (
                        <td
                          key={name}
                          className="bg-muted/30 px-1 py-1.5 text-center text-muted-foreground/40"
                        >
                          –
                        </td>
                      )
                    }
                    const q = qtyOf(item)
                    const cut = q < item.orderedQuantity
                    return (
                      <td key={name} className="px-1 py-1.5 text-center align-top">
                        {canEdit ? (
                          <Input
                            value={draft[item.id] ?? ""}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                [item.id]: e.target.value.replace(/[^0-9]/g, ""),
                              }))
                            }
                            // 바이어는 처음 주문한 수량 안에서만 줄일 수 있다
                            max={isAdmin ? undefined : item.orderedQuantity}
                            className={`mx-auto h-8 w-14 px-1 text-center ${cut ? "border-amber-400" : ""}`}
                            inputMode="numeric"
                          />
                        ) : (
                          <span className="tabular-nums">{item.quantity}</span>
                        )}
                        {/* 깎이기 전 수량과 재고를 작게 곁들인다 */}
                        <p className="mt-0.5 h-3 text-[10px] leading-tight text-muted-foreground">
                          {cut && (
                            <span className="text-amber-600" title={t("orderedQty")}>
                              {item.orderedQuantity}
                            </span>
                          )}
                          {cut && isAdmin && item.stock !== undefined && " / "}
                          {isAdmin && item.stock !== undefined && (
                            <span title={t("stockOnHand")}>{item.stock}</span>
                          )}
                        </p>
                      </td>
                    )
                  })}
                  <td className="border-l px-3 py-1.5 text-right tabular-nums">{rowQty}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                    {pMin === pMax ? fp(pMin) : `${fp(pMin)}~${fp(pMax)}`}
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                    {fp(rowAmount)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-muted/50 font-medium">
              <td
                colSpan={2}
                className="sticky left-0 z-10 border-r bg-muted/50 px-3 py-2 text-xs text-muted-foreground"
              >
                {t("sizeTotal")}
              </td>
              {sizeNames.map((name) => (
                <td key={name} className="px-1 py-2 text-center tabular-nums">
                  {columnTotals[name] || ""}
                </td>
              ))}
              <td className="border-l px-3 py-2 text-right tabular-nums">{totalQty}</td>
              <td />
              <td className="px-3 py-2 text-right tabular-nums">{fp(total)}</td>
            </tr>
          </tfoot>
        </table>
      </DropZone>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) importSheet(f)
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                <Upload className="mr-1 h-3 w-3" />
                {t("sheetImport")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => submit()} disabled={busy || !changed}>
                {busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                {tc("save")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => submit("BUYER_REVIEW")} disabled={busy}>
                <Send className="mr-1 h-3 w-3" />
                {t("sendToBuyer")}
              </Button>
              <Button size="sm" onClick={confirm} disabled={busy}>
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {t("confirmOrder")}
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => submit("STOCK_CHECKING")} disabled={busy}>
              <Send className="mr-1 h-3 w-3" />
              {t("sendToSeller")}
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {isAdmin ? t("adminRevisionHint") : t("buyerRevisionHint")}
          </span>
        </div>
      )}
    </div>
  )
}
