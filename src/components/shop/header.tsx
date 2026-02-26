"use client"

import Link from "next/link"
import { useSession, signOut } from "next-auth/react"
import { ShoppingCart, Menu, X, User, LogOut, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { useState } from "react"

export function ShopHeader() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* Mobile menu */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64">
            <SheetTitle className="sr-only">메뉴</SheetTitle>
            <nav className="flex flex-col gap-4 pt-8">
              <Link href="/products" onClick={() => setOpen(false)} className="text-lg font-medium">
                상품목록
              </Link>
              {session && (
                <>
                  <Link href="/cart" onClick={() => setOpen(false)} className="text-lg font-medium">
                    장바구니
                  </Link>
                  <Link href="/orders" onClick={() => setOpen(false)} className="text-lg font-medium">
                    주문내역
                  </Link>
                  <Link href="/mypage" onClick={() => setOpen(false)} className="text-lg font-medium">
                    마이페이지
                  </Link>
                </>
              )}
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link href="/" className="text-xl font-bold">
          도매몰
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/products" className="text-sm font-medium hover:text-primary">
            상품목록
          </Link>
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {session ? (
            <>
              <Link href="/cart">
                <Button variant="ghost" size="icon">
                  <ShoppingCart className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/orders" className="hidden md:block">
                <Button variant="ghost" size="icon">
                  <Package className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/mypage" className="hidden md:block">
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </Link>
              <Button variant="ghost" size="icon" onClick={() => signOut()}>
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <Link href="/auth/login">
              <Button size="sm">로그인</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
