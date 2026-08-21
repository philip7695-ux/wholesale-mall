import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getBankConfigForTrade } from "@/lib/payment-setting.server"

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // 계좌이체는 회원의 거래유형(국내/수출)에 맞는 계좌 하나만 보여준다.
    // 외화 계좌는 별도 결제수단이 아니라 같은 "계좌이체"의 다른 계좌다.
    const me = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { tradeType: true },
    })
    const bank = await getBankConfigForTrade(me?.tradeType)

    const others = await prisma.paymentConfig.findMany({
      where: { enabled: true, method: { in: ["ALIPAY", "WECHAT"] } },
      select: { method: true, accountName: true, accountInfo: true, bankName: true, qrCodeUrl: true, memo: true },
      orderBy: { method: "asc" },
    })

    const result: any[] = []
    if (bank && bank.enabled) {
      result.push({
        method: "BANK_TRANSFER",
        accountName: bank.accountName,
        accountInfo: bank.accountInfo,
        bankName: bank.bankName,
        qrCodeUrl: bank.qrCodeUrl,
        memo: bank.memo,
      })
    }
    result.push(...others)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json([])
  }
}
