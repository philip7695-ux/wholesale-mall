"use client"

import { useSession } from "next-auth/react"
import { GRADE_DISCOUNT } from "@/lib/grade"
import { formatPriceCross } from "@/lib/utils"
import { useCurrency } from "@/hooks/use-currency"
import { useLocale } from "next-intl"

interface ProductPriceProps {
  minPrice: number
  priceCurrency: string
}

export function ProductPrice({ minPrice, priceCurrency }: ProductPriceProps) {
  const { data: session } = useSession()
  const locale = useLocale()
  const { rates } = useCurrency()

  const buyerGrade = session?.user?.buyerGrade || "BRONZE"
  const discountRate = GRADE_DISCOUNT[buyerGrade] || 0

  if (minPrice <= 0) return <>-</>

  const fp = (amount: number) => formatPriceCross(amount, priceCurrency, locale, rates)

  if (discountRate > 0) {
    return (
      <>
        <span className="text-muted-foreground font-normal line-through text-xs">
          {fp(minPrice)}
        </span>{" "}
        <span className="text-primary">
          {fp(Math.round(minPrice * (1 - discountRate) * 100) / 100)}
        </span>
      </>
    )
  }

  return <>{fp(minPrice)}</>
}
