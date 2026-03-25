"use client"

import { useState } from "react"
import { signIn, getSession } from "next-auth/react"
import { Link, useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { LanguageSelector } from "@/components/language-selector"

export default function LoginPage() {
  const router = useRouter()
  const t = useTranslations("auth")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      console.error("Login error:", result.error)
      setError(t("loginError"))
    } else {
      const session = await getSession()
      const role = session?.user?.role || ""
      router.refresh()
      if (role === "ADMIN") {
        router.replace("/admin")
      } else {
        router.replace("/products")
      }
    }
  }

  return (
    <>
      {/* Language selector */}
      <div className="absolute right-6 top-6">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-sm mx-auto">
        {/* Brand */}
        <div className="mb-12">
          <h1 className="text-3xl font-light tracking-tight text-[#1A1A1A]">
            {t("loginTitle")}
          </h1>
          <p className="mt-2 text-sm text-gray-400 font-light tracking-wide">
            {t("loginDesc")}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-xs font-medium uppercase tracking-widest text-gray-500">
              {t("email")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="email@example.com"
              className="w-full border-b border-gray-200 bg-transparent py-3 text-sm text-[#1A1A1A] placeholder:text-gray-300 focus:border-[#1A1A1A] focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-xs font-medium uppercase tracking-widest text-gray-500">
              {t("password")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder={t("passwordPlaceholder")}
              className="w-full border-b border-gray-200 bg-transparent py-3 text-sm text-[#1A1A1A] placeholder:text-gray-300 focus:border-[#1A1A1A] focus:outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-8 w-full bg-[#1A1A1A] py-3.5 text-sm font-medium uppercase tracking-widest text-white transition-transform active:scale-95 hover:bg-[#333] disabled:opacity-50"
          >
            {loading ? t("loggingIn") : t("loginButton")}
          </button>
        </form>

        {/* Bottom links */}
        <div className="mt-10 flex items-center justify-between text-xs text-gray-400">
          <Link
            href="/auth/register"
            className="uppercase tracking-wider hover:text-[#1A1A1A] transition-colors"
          >
            {t("applyMembership")}
          </Link>
          <span className="text-gray-200">|</span>
          <button
            type="button"
            className="uppercase tracking-wider hover:text-[#1A1A1A] transition-colors"
          >
            {t("forgotPassword")}
          </button>
        </div>
      </div>
    </>
  )
}
