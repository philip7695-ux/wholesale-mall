"use client"

import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui/button"

const gradeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  BRONZE: "outline",
  SILVER: "secondary",
  GOLD: "default",
  VIP: "destructive",
}

interface GradeInfo {
  grade: string
  discountRate: number
  totalSpendingUSD: number
  nextGrade: string | null
  nextThreshold: number | null
  remaining: number | null
}

export default function MyPage() {
  const { data: session } = useSession()
  const t = useTranslations("mypage")
  const [gradeInfo, setGradeInfo] = useState<GradeInfo | null>(null)

  useEffect(() => {
    fetch("/api/me/grade")
      .then((res) => res.json())
      .then(setGradeInfo)
      .catch(() => {})
  }, [])

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

      {/* 등급 카드 */}
      <Card>
        <CardHeader>
          <CardTitle>{t("gradeTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">{t("gradeLabel")}</span>
            <Badge variant={gradeVariant[session.user.buyerGrade] || "outline"}>
              {t(`grade${session.user.buyerGrade.charAt(0)}${session.user.buyerGrade.slice(1).toLowerCase()}` as any)}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("discountRate")}</span>
            <span>
              {gradeInfo ? `${Math.round(gradeInfo.discountRate * 100)}%` : "-"}
            </span>
          </div>
          {gradeInfo && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("totalSpending")}</span>
                <span>${gradeInfo.totalSpendingUSD.toLocaleString()}</span>
              </div>
              {gradeInfo.nextGrade && gradeInfo.nextThreshold && gradeInfo.remaining !== null ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {t("nextGrade")}: {gradeInfo.nextGrade}
                    </span>
                    <span className="text-muted-foreground">
                      {t("remaining")}: ${gradeInfo.remaining.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(100, ((gradeInfo.totalSpendingUSD / gradeInfo.nextThreshold) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t("gradeMaxReached")}</p>
              )}
            </>
          )}
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
