"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, Send, CheckCircle2 } from "lucide-react"
import { formatPrice } from "@/lib/utils"

export interface RevisionItem {
  id: string
  productName: string
  colorName: string
  sizeName: string
  quantity: number
  orderedQuantity: number
  price: number
  /** 관리자에게만 내려준다. 창고 확인 전 참고용 */
  stock?: number
}

/**
 * 확정 전 주문의 수량을 고치는 표.
 *
 * 창고에서 물건을 확인한 뒤 관리자가 줄이고, 바이어가 보고 다시 고치는
 * 과정이 오간다. 양쪽이 같은 표를 보되 할 수 있는 일이 다르다.
 *   관리자 - 수량을 자유롭게 고치고 바이어에게 넘기거나 확정한다
 *   바이어 - 처음 주문한 수량 안에서만 줄이고 관리자에게 돌려보낸다
 *
 * 처음 주문 수량을 함께 보여줘 무엇이 얼마나 깎였는지 드러낸다.
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
  const fp = (amount: number) => formatPrice(amount, locale, rate)

  const changed = items.some((i) => Number(draft[i.id]) !== i.quantity)
  const total = items.reduce((s, i) => s + i.price * (Number(draft[i.id]) || 0), 0)

  async function submit(next?: "STOCK_CHECKING" | "BUYER_REVIEW") {
    setBusy(true)
    try {
      const res = await fetch(`/api/orders/${orderId}/items`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ id: i.id, quantity: Number(draft[i.id]) || 0 })),
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
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">{t("product")}</th>
              <th className="px-3 py-2 font-medium">{t("color")}</th>
              <th className="px-3 py-2 font-medium">{t("size")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("orderedQty")}</th>
              {isAdmin && <th className="px-3 py-2 text-right font-medium">{t("stockOnHand")}</th>}
              <th className="px-3 py-2 text-right font-medium">{t("currentQty")}</th>
              <th className="px-3 py-2 text-right font-medium">{t("amount")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => {
              const q = Number(draft[i.id]) || 0
              const cut = q < i.orderedQuantity
              return (
                <tr key={i.id} className="border-t">
                  <td className="px-3 py-2">{i.productName}</td>
                  <td className="px-3 py-2">{i.colorName}</td>
                  <td className="px-3 py-2">{i.sizeName}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {i.orderedQuantity}
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {i.stock ?? "-"}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right">
                    {canEdit ? (
                      <Input
                        value={draft[i.id] ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [i.id]: e.target.value.replace(/[^0-9]/g, "") }))
                        }
                        // 바이어는 처음 주문한 수량 안에서만 줄일 수 있다
                        max={isAdmin ? undefined : i.orderedQuantity}
                        className={`ml-auto h-8 w-20 text-right ${cut ? "border-amber-400" : ""}`}
                        inputMode="numeric"
                      />
                    ) : (
                      <span className="tabular-nums">{i.quantity}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fp(i.price * q)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t bg-muted/30">
            <tr>
              <td className="px-3 py-2 font-medium" colSpan={isAdmin ? 5 : 4}>
                {t("itemsTotal")}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {items.reduce((s, i) => s + (Number(draft[i.id]) || 0), 0)}
              </td>
              <td className="px-3 py-2 text-right font-medium tabular-nums">
                {fp(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <>
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
