import { NextResponse } from "next/server"
import { getExchangeRate, getAllExchangeRates } from "@/lib/currency.server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get("locale") || "ko"

  const [{ currency, rate }, rates] = await Promise.all([
    getExchangeRate(locale),
    getAllExchangeRates(),
  ])

  return NextResponse.json({ currency, rate, rates })
}
