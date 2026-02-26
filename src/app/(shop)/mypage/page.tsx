"use client"

import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function MyPage() {
  const { data: session } = useSession()

  if (!session) return null

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">마이페이지</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>내 정보</CardTitle>
          <Link href="/mypage/edit">
            <Button variant="outline" size="sm">정보 수정</Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">이름</span>
            <span>{session.user.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">이메일</span>
            <span>{session.user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">계정 상태</span>
            <Badge variant={session.user.approvalStatus === "APPROVED" ? "default" : "secondary"}>
              {session.user.approvalStatus === "APPROVED" ? "승인됨" : "승인대기"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/orders">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-center py-8">
              <Button variant="ghost">주문 내역 보기</Button>
            </CardContent>
          </Card>
        </Link>
        <Link href="/cart">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="flex items-center justify-center py-8">
              <Button variant="ghost">장바구니 보기</Button>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
