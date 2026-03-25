"use client"

import { MessageCircle } from "lucide-react"
import { useTranslations } from "next-intl"

export function ConciergeButton() {
  const t = useTranslations("shop")

  return (
    <button
      onClick={() => {
        // TODO: integrate chat service
      }}
      className="fixed bottom-8 right-8 z-50 flex items-center gap-2.5 bg-[#1A1A1A] px-5 py-3 text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
    >
      <MessageCircle className="h-4 w-4" />
      <span className="text-xs font-medium uppercase tracking-widest">
        {t("chatConcierge")}
      </span>
    </button>
  )
}
