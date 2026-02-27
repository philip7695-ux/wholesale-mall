"use client"

import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"

export default function MyPage() {
  const { data: session } = useSession()
  const t = useTranslations("mypage")

  if (!session) return null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t("myInfo")}</CardTitle>
          <Link href="/mypage/edit">
            <Button variant="outline" size="sm">{t("editInfo")}</Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("nameLabel")}</span>
            <span>{session.user.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("emailLabel")}</span>
            <span>{session.user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("accountStatus")}</span>
            <Badge variant={session.user.approvalStatus === "APPROVED" ? "default" : "secondary"}>
              {session.user.approvalStatus === "APPROVED" ? t("approved") : t("pendingApproval")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/orders">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-center py-8">
              <Button variant="ghost">{t("viewOrders")}</Button>
            </CardContent>
          </Card>
        </Link>
        <Link href="/cart">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-center py-8">
              <Button variant="ghost">{t("viewCart")}</Button>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
