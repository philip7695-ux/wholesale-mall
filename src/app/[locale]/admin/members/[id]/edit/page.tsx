"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useRouter } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

export default function EditMemberPage() {
  const router = useRouter()
  const params = useParams()
  const memberId = params.id as string
  const t = useTranslations("admin")
  const ta = useTranslations("auth")
  const tc = useTranslations("common")
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [member, setMember] = useState({
    name: "",
    email: "",
    phone: "",
    businessName: "",
    businessNumber: "",
    businessAddress: "",
  })

  useEffect(() => {
    fetch(`/api/admin/members/${memberId}`)
      .then((res) => res.json())
      .then((data) => {
        setMember({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          businessName: data.businessName || "",
          businessNumber: data.businessNumber || "",
          businessAddress: data.businessAddress || "",
        })
      })
      .catch(() => toast.error(tc("error")))
      .finally(() => setFetching(false))
  }, [memberId, tc])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const data = {
      name: formData.get("name"),
      phone: formData.get("phone"),
      businessName: formData.get("businessName"),
      businessNumber: formData.get("businessNumber"),
      businessAddress: formData.get("businessAddress"),
    }

    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const result = await res.json()
        throw new Error(result.error)
      }

      toast.success(t("memberUpdated"))
      router.push("/admin/members")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("memberUpdateError"))
    }
    setLoading(false)
  }

  if (fetching) {
    return <div className="py-10 text-center text-muted-foreground">{tc("loading")}</div>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("editMemberTitle")}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("basicInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">{ta("name")}</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  defaultValue={member.name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{ta("emailRequired")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={member.email}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">{ta("phone")}</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={member.phone}
                placeholder="010-1234-5678"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{ta("businessInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="businessName">{ta("businessName")}</Label>
                <Input
                  id="businessName"
                  name="businessName"
                  defaultValue={member.businessName}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessNumber">{ta("businessNumber")}</Label>
                <Input
                  id="businessNumber"
                  name="businessNumber"
                  defaultValue={member.businessNumber}
                  placeholder="000-00-00000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessAddress">{ta("businessAddress")}</Label>
              <Input
                id="businessAddress"
                name="businessAddress"
                defaultValue={member.businessAddress}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            {tc("cancel")}
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? tc("saving") : tc("save")}
          </Button>
        </div>
      </form>
    </div>
  )
}
