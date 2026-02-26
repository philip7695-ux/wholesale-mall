import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="flex flex-col items-center gap-4 py-12 text-center">
        <h1 className="text-3xl font-bold sm:text-4xl">의류 도매 쇼핑몰</h1>
        <p className="max-w-md text-muted-foreground">
          최신 트렌드 의류를 도매가로 만나보세요.<br />
          사업자 회원 전용 B2B 쇼핑몰입니다.
        </p>
        <Link href="/products">
          <Button size="lg">상품 보러가기</Button>
        </Link>
      </section>
    </div>
  )
}
