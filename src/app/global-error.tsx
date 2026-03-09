"use client"

const messages: Record<string, { title: string; desc: string; retry: string }> = {
  ko: { title: "일시적인 오류가 발생했습니다", desc: "잠시 후 다시 시도해주세요.", retry: "다시 시도" },
  en: { title: "A temporary error occurred", desc: "Please try again later.", retry: "Retry" },
  zh: { title: "发生临时错误", desc: "请稍后再试。", retry: "重试" },
  ja: { title: "一時的なエラーが発生しました", desc: "しばらくしてから再度お試しください。", retry: "再試行" },
}

function detectLocale(): string {
  if (typeof window === "undefined") return "ko"
  const path = window.location.pathname
  const match = path.match(/^\/(en|zh|ja)(\/|$)/)
  if (match) return match[1]
  return "ko"
}

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const locale = detectLocale()
  const m = messages[locale] || messages.ko

  return (
    <html>
      <body>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "sans-serif",
          gap: "16px",
        }}>
          <h2 style={{ fontSize: "20px", fontWeight: "bold" }}>
            {m.title}
          </h2>
          <p style={{ color: "#666" }}>{m.desc}</p>
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 24px",
              backgroundColor: "#000",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            {m.retry}
          </button>
        </div>
      </body>
    </html>
  )
}
