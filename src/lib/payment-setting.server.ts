import "server-only"
import { prisma } from "@/lib/prisma"

export async function getPaymentSetting() {
  return prisma.paymentSetting.findFirst()
}

export async function getAdminNotificationEmail() {
  const setting = await prisma.paymentSetting.findFirst({
    select: { notificationEmail: true },
  })
  if (setting?.notificationEmail) return setting.notificationEmail

  // 폴백: 첫 번째 ADMIN 유저 이메일
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { email: true },
  })
  return admin?.email || null
}
