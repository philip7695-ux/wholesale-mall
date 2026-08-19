"use client"

import { useState } from "react"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { SUPPORTED_CURRENCIES } from "@/lib/currency"

/**
 * 회원의 거래 유형과 결제 통화.
 *
 * 국내 거래는 통화가 KRW 로 고정되고 부가세 10% 가 붙으므로 통화 선택을
 * 감춘다. 수출은 통화를 고를 수 있고, 비워두면 접속 언어를 따라간다.
 */
export function MemberTradeSelect({
  memberId,
  tradeType,
  currency,
}: {
  memberId: string
  tradeType: string
  currency: string | null
}) {
  const router = useRouter()
  const t = useTranslations("admin")
  const [type, setType] = useState(tradeType)
  const [cur, setCur] = useState(currency ?? "")

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      toast.success(t("saved"))
      router.refresh()
    } else {
      toast.error(t("saveFailed"))
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Select
        value={type}
        onValueChange={(v) => {
          setType(v)
          // 국내로 바꾸면 통화 지정은 의미가 없으므로 함께 비운다
          if (v === "DOMESTIC") setCur("")
          patch({ tradeType: v, ...(v === "DOMESTIC" ? { currency: null } : {}) })
        }}
      >
        <SelectTrigger className="h-7 w-24 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="DOMESTIC" className="text-xs">{t("tradeDomestic")}</SelectItem>
          <SelectItem value="EXPORT" className="text-xs">{t("tradeExport")}</SelectItem>
        </SelectContent>
      </Select>

      {type === "EXPORT" && (
        <Select
          value={cur || "AUTO"}
          onValueChange={(v) => {
            const next = v === "AUTO" ? "" : v
            setCur(next)
            patch({ currency: next || null })
          }}
        >
          <SelectTrigger className="h-7 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AUTO" className="text-xs">{t("currencyAuto")}</SelectItem>
            {SUPPORTED_CURRENCIES.filter((c) => c !== "KRW").map((c) => (
              <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
