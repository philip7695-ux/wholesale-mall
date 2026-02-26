"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      email: formData.get("email"),
      password: formData.get("password"),
      name: formData.get("name"),
      phone: formData.get("phone"),
      businessName: formData.get("businessName"),
      businessNumber: formData.get("businessNumber"),
      businessAddress: formData.get("businessAddress"),
    }

    const confirmPassword = formData.get("confirmPassword")
    if (data.password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.")
      setLoading(false)
      return
    }

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    const result = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(result.error)
    } else {
      router.push("/auth/pending")
    }
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">회원가입</CardTitle>
        <CardDescription>사업자 정보를 등록해주세요. 관리자 승인 후 이용 가능합니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">이름 *</Label>
              <Input id="name" name="name" required placeholder="홍길동" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">전화번호</Label>
              <Input id="phone" name="phone" placeholder="010-1234-5678" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">이메일 *</Label>
            <Input id="email" name="email" type="email" required placeholder="email@example.com" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호 *</Label>
              <Input id="password" name="password" type="password" required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">비밀번호 확인 *</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" required minLength={6} />
            </div>
          </div>
          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium">사업자 정보</p>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">상호명</Label>
                <Input id="businessName" name="businessName" placeholder="(주)도매패션" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessNumber">사업자등록번호</Label>
                <Input id="businessNumber" name="businessNumber" placeholder="000-00-00000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessAddress">사업장 주소</Label>
                <Input id="businessAddress" name="businessAddress" placeholder="서울시 중구..." />
              </div>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "가입 중..." : "회원가입"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            이미 계정이 있으신가요?{" "}
            <Link href="/auth/login" className="text-primary underline">
              로그인
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
