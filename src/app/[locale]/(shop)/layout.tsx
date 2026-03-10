import { ShopHeader } from "@/components/shop/header"
import { ShopSidebar } from "@/components/shop/sidebar"
import { AuthSessionProvider } from "@/components/shop/session-provider"

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <ShopSidebar />
        </div>

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <ShopHeader />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthSessionProvider>
  )
}
