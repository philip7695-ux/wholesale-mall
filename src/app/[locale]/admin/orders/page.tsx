export const dynamic = 'force-dynamic'

import { prisma } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"
import { Card, CardContent } from "@/components/ui/card"
import { OrderList } from "@/components/admin/order-list"

export default async function AdminOrdersPage() {
  const t = await getTranslations("admin")

  const orders = await prisma.order.findMany({
    include: {
      user: { select: { name: true, email: true } },
      items: true,
      paymentConfirmations: {
        where: { status: "PENDING" },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  if (orders.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("orderMgmt")}</h1>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {t("noOrdersAdmin")}
          </CardContent>
        </Card>
      </div>
    )
  }

  // 직렬화 (Date → string)
  const serialized = orders.map((o) => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    hasPaymentRequest: o.paymentConfirmations.length > 0,
    paymentConfirmations: undefined,
    items: o.items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  }))

  return (
    <div className="space-y-4">
      <OrderList orders={serialized} />
    </div>
  )
}
