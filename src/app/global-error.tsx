"use client"

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
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
            일시적인 오류가 발생했습니다
          </h2>
          <p style={{ color: "#666" }}>잠시 후 다시 시도해주세요.</p>
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
            다시 시도
          </button>
        </div>
      </body>
    </html>
  )
}
