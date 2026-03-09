import { getTranslations } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { PaymentSettingsForm } from "@/components/admin/payment-settings-form"

export const dynamic = "force-dynamic"

export default async function PaymentSettingsPage() {
  const t = await getTranslations("admin")
  const setting = await prisma.paymentSetting.findFirst()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("paymentSettingsTitle")}</h1>
      <PaymentSettingsForm
        initialData={
          setting
            ? {
                notificationEmail: setting.notificationEmail || "",
                bankName: setting.bankName || "",
                accountNumber: setting.accountNumber || "",
                accountHolder: setting.accountHolder || "",
                bankNote: setting.bankNote || "",
                alipayQrImage: setting.alipayQrImage || "",
                alipayNote: setting.alipayNote || "",
                wechatQrImage: setting.wechatQrImage || "",
                wechatNote: setting.wechatNote || "",
              }
            : null
        }
      />
    </div>
  )
}
