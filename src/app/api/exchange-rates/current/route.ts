import { NextResponse } from "next/server"
import { getExchangeRate } from "@/lib/currency.server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get("locale") || "ko"

  const { currency, rate } = await getExchangeRate(locale)

  return NextResponse.json({ currency, rate })
}
