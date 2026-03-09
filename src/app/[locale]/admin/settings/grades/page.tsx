import { getTranslations } from "next-intl/server"
import { getGradeConfig } from "@/lib/grade.server"
import { GradeConfigForm } from "@/components/admin/grade-config-form"

export const dynamic = "force-dynamic"

export default async function GradeSettingsPage() {
  const t = await getTranslations("admin")
  const configs = await getGradeConfig()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("gradeSettingsTitle")}</h1>
      <GradeConfigForm initialConfigs={configs} />
    </div>
  )
}
