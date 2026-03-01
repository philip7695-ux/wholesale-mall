import { prisma } from "@/lib/prisma"
import { getTranslations } from "next-intl/server"
import { isWiseConfigured } from "@/lib/wise"
import { WiseConfigForm } from "@/components/admin/wise-config-form"

export const dynamic = "force-dynamic"

export default async function WiseSettingsPage() {
  const t = await getTranslations("admin")

  const config = await prisma.wiseConfig.findFirst()
  const unmatchedLogs = await prisma.wiseWebhookLog.findMany({
    where: { matched: false },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("wiseSettings")}</h1>
      <WiseConfigForm
        profileId={config?.profileId ?? ""}
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
  )
}
