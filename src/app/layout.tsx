import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // 루트 레이아웃은 로케일을 알 수 없어 기본 로케일(ko)로 지정.
    // suppressHydrationWarning: 클라이언트에서 로케일별로 lang이 조정될 수 있음.
    <html lang="ko" suppressHydrationWarning>
      <body className="font-sans antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
