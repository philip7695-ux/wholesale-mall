import Image from "next/image"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const FALLBACK_IMAGE = "/images/login-hero.jpg"

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // 로그인 화면은 DB 가 죽어도 떠야 한다. 실패하면 기본값으로 렌더한다.
  const config = await prisma.storeConfig
    .findUnique({
      where: { id: "default" },
      select: { loginHeroUrl: true, loginTagline: true, loginTitle: true },
    })
    .catch(() => null)

  const heroUrl = config?.loginHeroUrl || FALLBACK_IMAGE
  const tagline = config?.loginTagline ?? "Members Only"
  const title = config?.loginTitle ?? "Wholesale Fashion Platform"

  return (
    <div className="flex min-h-screen">
      {/* Left: Fashion hero image */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden">
        <Image
          src={heroUrl}
          alt=""
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/20" />
        {/* Overlay brand text */}
        <div className="absolute bottom-12 left-12 right-12">
          <p className="text-white/70 text-sm tracking-[0.3em] uppercase font-light">
            {tagline}
          </p>
          <h2 className="text-white text-4xl font-light mt-2 leading-tight tracking-tight whitespace-pre-line">
            {title}
          </h2>
        </div>
      </div>

      {/* Right: Auth form */}
      <div className="relative flex w-full items-center justify-center bg-white px-6 lg:w-1/2">
        {children}
      </div>
    </div>
  )
}
