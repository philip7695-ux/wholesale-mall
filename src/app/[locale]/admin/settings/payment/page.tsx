import { prisma } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"
import { isWiseConfigured } from "@/lib/wise"
import { WiseConfigForm } from "@/components/admin/wise-config-form"
import { PaymentConfigForm } from "@/components/admin/payment-config-form"
import { StoreConfigForm } from "@/components/admin/store-config-form"

export const dynamic = "force-dynamic"

export default async function PaymentSettingsPage() {
  const t = await getTranslations("admin")

  const wiseConfig = await prisma.wiseConfig.findFirst()
  const unmatchedLogs = await prisma.wiseWebhookLog.findMany({
    where: { matched: false },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  let paymentConfigs: { method: string; enabled: boolean; accountName: string; accountInfo: string; bankName: string; qrCodeUrl: string; memo: string }[] = []
  try {
    paymentConfigs = await prisma.paymentConfig.findMany({
      orderBy: { method: "asc" },
    })
  } catch {
    // Table may not exist yet until next deploy runs prisma db push
  }

  let storeConfig = {
    companyName: "",
    address: "",
    phone: "",
    email: "",
    footerMessage: "",
    footerTerms: "",
  }
  try {
    const sc = await prisma.storeConfig.findUnique({ where: { id: "default" } })
    if (sc) {
      storeConfig = {
        companyName: sc.companyName,
        address: sc.address,
        phone: sc.phone,
        email: sc.email,
        footerMessage: sc.footerMessage,
        footerTerms: sc.footerTerms,
      }
    }
  } catch {
    // Table may not exist yet
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">{t("paymentSettings")}</h1>

      {/* Store / Company Info */}
      <StoreConfigForm initialConfig={storeConfig} />

      {/* Payment Method Configs */}
      <PaymentConfigForm
        initialConfigs={paymentConfigs.map((c) => ({
          method: c.method,
          enabled: c.enabled,
          accountName: c.accountName,
          accountInfo: c.accountInfo,
          bankName: c.bankName,
          qrCodeUrl: c.qrCodeUrl,
          memo: c.memo,
        }))}
      />

      {/* Wise API Config (existing) */}
      <div className="border-t pt-8">
        <h2 className="mb-4 text-xl font-bold">{t("wiseSettings")}</h2>
        <WiseConfigForm
          profileId={wiseConfig?.profileId ?? ""}
          apiTokenConfigured={isWiseConfigured()}
          unmatchedLogs={unmatchedLogs.map((log) => ({
            id: log.id,
            deliveryId: log.deliveryId,
            eventType: log.eventType,
            error: log.error,
            createdAt: log.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  )
}
