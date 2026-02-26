import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MemberApprovalButton } from "@/components/admin/member-approval-button"

const approvalLabels: Record<string, string> = {
  PENDING: "승인대기",
  APPROVED: "승인됨",
  REJECTED: "거절됨",
}

const approvalVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  APPROVED: "default",
  REJECTED: "destructive",
}

export default async function AdminMembersPage() {
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
        <h1 className="text-2xl font-bold">회원 관리</h1>
        <Button asChild>
          <Link href="/admin/members/new">회원 등록</Link>
        </Button>
      </div>

      {members.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            등록된 회원이 없습니다.
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
                    {member.businessName && <p>상호: {member.businessName}</p>}
                    {member.businessNumber && <p>사업자번호: {member.businessNumber}</p>}
                    {member.phone && <p>전화: {member.phone}</p>}
                    <p>주문 {member._count.orders}건 | 가입: {member.createdAt.toLocaleDateString("ko-KR")}</p>
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
