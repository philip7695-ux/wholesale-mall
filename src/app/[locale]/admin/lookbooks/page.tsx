import { getTranslations } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { LookbookManager } from "@/components/admin/lookbook-manager"

export const dynamic = "force-dynamic"

export default async function AdminLookbooksPage() {
  const t = await getTranslations("admin")
  const items = await prisma.lookbook.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  })
  const initial = items.map((i) => ({
    id: i.id,
    title: i.title,
    url: i.url,
    format: i.format,
    bytes: i.bytes,
    isActive: i.isActive,
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("lookbookMgmt")}</h1>
      <LookbookManager initial={initial} />
    </div>
  )
}
