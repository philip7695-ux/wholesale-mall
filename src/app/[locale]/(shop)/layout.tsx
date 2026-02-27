import { ShopHeader } from "@/components/shop/header"
import { ShopFooter } from "@/components/shop/footer"
import { AuthSessionProvider } from "@/components/shop/session-provider"

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
      <div className="flex min-h-screen flex-col">
        <ShopHeader />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
          {children}
        </main>
        <ShopFooter />
      </div>
    </AuthSessionProvider>
  )
}
