export const dynamic = 'force-dynamic'

import { prisma } from "@/lib/prisma"
import { Link } from "@/i18n/navigation"
import { getTranslations, getLocale } from "next-intl/server"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MemberApprovalButton } from "@/components/admin/member-approval-button"
import { MemberGradeSelect } from "@/components/admin/member-grade-select"
import { MemberRoleSelect } from "@/components/admin/member-role-select"
import { MemberTradeSelect } from "@/components/admin/member-trade-select"
import { formatDate, formatPrice } from "@/lib/utils"
import { getExchangeRate } from "@/lib/currency.server"
import { auth } from "@/lib/auth"

const approvalVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
}

const gradeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  BRONZE: "outline",
  SILVER: "secondary",
  GOLD: "default",
  VIP: "destructive",
}

export default async function AdminMembersPage() {
  const t = await getTranslations("admin")
  const locale = await getLocale()
  const [{ rate }, session] = await Promise.all([
    getExchangeRate(locale),
    auth(),
  ])

  const approvalLabels: Record<string, string> = {
    PENDING: t("approvalPending"),
    APPROVED: t("approvalApproved"),
    REJECTED: t("approvalRejected"),
  }

  const roleLabels: Record<string, string> = {
    ADMIN: t("adminRole"),
    BUYER: t("buyer"),
  }

  const members = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      businessName: true,
      businessNumber: true,
      country: true,
      adminNote: true,
      approvalStatus: true,
      buyerGrade: true,
      tradeType: true,
      currency: true,
      createdAt: true,
      _count: { select: { orders: true } },
      orders: {
        where: { status: { not: "CANCELLED" } },
        select: { totalAmount: true },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("memberListTitle")}</h1>
        <Button asChild>
          <Link href="/admin/members/new">{t("addMember")}</Link>
        </Button>
      </div>

      {members.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("noMembers")}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {members.map((member: any) => {
            const totalSpending = member.orders.reduce((sum: number, o: any) => sum + o.totalAmount, 0)
            return (
              <Card key={member.id}>
                <CardContent className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
                  {/* 왼쪽: 신원 + 메타를 한 덩어리로 */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium">{member.name}</span>
                      <span className="text-sm text-muted-foreground">{member.email}</span>
                      <Badge variant={member.role === "ADMIN" ? "destructive" : "secondary"}>
                        {roleLabels[member.role]}
                      </Badge>
                      {member.role === "BUYER" && (
                        <>
                          <Badge variant={gradeVariant[member.buyerGrade]}>{member.buyerGrade}</Badge>
                          <Badge variant={approvalVariant[member.approvalStatus]}>
                            {approvalLabels[member.approvalStatus]}
                          </Badge>
                        </>
                      )}
                    </div>
                    {/* 메타는 점으로 이어 한 줄에 */}
                    <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                      {member.businessName && <span>{t("businessPrefix")}{member.businessName}</span>}
                      {member.businessNumber && <span>· {member.businessNumber}</span>}
                      {member.phone && <span>· {member.phone}</span>}
                      {member.country && <span>· {member.country}</span>}
                      <span>· {t("orderCount", { count: member._count.orders })}{formatDate(member.createdAt, locale)}</span>
                      <span>· {t("totalSpendingLabel")}: {formatPrice(totalSpending, locale, rate)}</span>
                    </p>
                    {member.adminNote && (
                      <p className="whitespace-pre-wrap text-xs text-amber-700 dark:text-amber-400">
                        {t("adminNotePrefix")}{member.adminNote}
                      </p>
                    )}
                  </div>

                  {/* 오른쪽: 컨트롤을 가로로 눕혀 감싼다 */}
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <MemberRoleSelect
                      memberId={member.id}
                      currentRole={member.role}
                      isSelf={member.id === session?.user?.id}
                    />
                    {member.role === "BUYER" && (
                      <>
                        <MemberGradeSelect memberId={member.id} currentGrade={member.buyerGrade} />
                        <MemberTradeSelect
                          memberId={member.id}
                          tradeType={member.tradeType}
                          currency={member.currency}
                        />
                        <MemberApprovalButton
                          memberId={member.id}
                          currentStatus={member.approvalStatus}
                        />
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/members/${member.id}/edit`}>{t("editMember")}</Link>
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
