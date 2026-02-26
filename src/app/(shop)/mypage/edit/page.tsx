"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

interface UserProfile {
  name: string
  email: string
  phone: string | null
  businessName: string | null
  businessNumber: string | null
  businessAddress: string | null
}

export default function EditProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then(setProfile)
      .finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    const formData = new FormData(e.currentTarget)
    const newPassword = formData.get("newPassword") as string
    const confirmPassword = formData.get("confirmPassword") as string

    if (newPassword && newPassword !== confirmPassword) {
      toast.error("새 비밀번호가 일치하지 않습니다.")
      setSaving(false)
      return
    }

    const data: Record<string, string> = {
      name: formData.get("name") as string,
      phone: formData.get("phone") as string,
      businessName: formData.get("businessName") as string,
      businessNumber: formData.get("businessNumber") as string,
      businessAddress: formData.get("businessAddress") as string,
    }

    if (newPassword) {
      data.currentPassword = formData.get("currentPassword") as string
      data.newPassword = newPassword
    }

    try {
      const res = await fetch("/api/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      toast.success("정보가 수정되었습니다.")
      router.push("/mypage")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "수정에 실패했습니다.")
    }
    setSaving(false)
  }

  if (loading || !profile) {
    return <div className="py-10 text-center text-muted-foreground">로딩중...</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">내 정보 수정</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>이메일</Label>
              <Input value={profile.email} disabled className="bg-muted" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">이름 *</Label>
                <Input id="name" name="name" required defaultValue={profile.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">전화번호</Label>
                <Input id="phone" name="phone" defaultValue={profile.phone || ""} placeholder="010-1234-5678" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>사업자 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="businessName">상호명</Label>
                <Input id="businessName" name="businessName" defaultValue={profile.businessName || ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessNumber">사업자등록번호</Label>
                <Input id="businessNumber" name="businessNumber" defaultValue={profile.businessNumber || ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessAddress">사업장 주소</Label>
              <Input id="businessAddress" name="businessAddress" defaultValue={profile.businessAddress || ""} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>비밀번호 변경</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPasswordForm(!showPasswordForm)}
              >
                {showPasswordForm ? "취소" : "변경하기"}
              </Button>
            </div>
          </CardHeader>
          {showPasswordForm && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">현재 비밀번호</Label>
                <Input id="currentPassword" name="currentPassword" type="password" required={showPasswordForm} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">새 비밀번호</Label>
                  <Input id="newPassword" name="newPassword" type="password" minLength={6} required={showPasswordForm} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
                  <Input id="confirmPassword" name="confirmPassword" type="password" minLength={6} required={showPasswordForm} />
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            취소
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "저장 중..." : "저장"}
          </Button>
        </div>
      </form>
    </div>
  )
}
