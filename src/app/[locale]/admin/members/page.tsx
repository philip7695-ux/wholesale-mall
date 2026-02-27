export const dynamic = 'force-dynamic'

import { prisma } from "@/lib/prisma"
import { Link } from "@/i18n/navigation"
import { getTranslations, getLocale } from "next-intl/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MemberApprovalButton } from "@/components/admin/member-approval-button"
import { formatDate } from "@/lib/utils"

const approvalVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
}

export default async function AdminMembersPage() {
  const t = await getTranslations("admin")
  const locale = await getLocale()

  const approvalLabels: Record<string, string> = {
    PENDING: t("approvalPending"),
    APPROVED: t("approvalApproved"),
    REJECTED: t("approvalRejected"),
  }

  const members = await prisma.user.findMany({
    where: { role: "BUYER" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      businessName: true,
      businessNumber: true,
      approvalStatus: true,
      createdAt: true,
      _count: { select: { orders: true } },
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
          {members.map((member: any) => (
            <Card key={member.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{member.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge variant={approvalVariant[member.approvalStatus]}>
                    {approvalLabels[member.approvalStatus]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {member.businessName && <p>{t("businessPrefix")}{member.businessName}</p>}
                    {member.businessNumber && <p>{t("businessNumberPrefix")}{member.businessNumber}</p>}
                    {member.phone && <p>{t("phonePrefix")}{member.phone}</p>}
                    <p>{t("orderCount", { count: member._count.orders })}{formatDate(member.createdAt, locale)}</p>
                  </div>
                  <MemberApprovalButton
                    memberId={member.id}
                    currentStatus={member.approvalStatus}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
