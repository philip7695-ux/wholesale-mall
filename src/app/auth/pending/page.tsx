import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function PendingPage() {
  return (
    <Card className="w-full max-w-md text-center">
      <CardHeader>
        <CardTitle className="text-2xl">승인 대기중</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          회원가입이 완료되었습니다.<br />
          관리자 승인 후 이용 가능합니다.
        </p>
        <Link href="/auth/login">
          <Button variant="outline">로그인 페이지로</Button>
        </Link>
      </CardContent>
    </Card>
  )
}
