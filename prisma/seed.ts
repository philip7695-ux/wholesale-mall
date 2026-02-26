import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { hash } from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  // Create admin user
  const adminPassword = await hash("admin123", 12)
  await prisma.user.upsert({
    where: { email: "admin@wholesale.com" },
    update: {},
    create: {
      email: "admin@wholesale.com",
      password: adminPassword,
      name: "관리자",
      role: "ADMIN",
      approvalStatus: "APPROVED",
    },
  })

  // Create categories
  const categories = [
    { name: "아우터", slug: "outer" },
    { name: "상의", slug: "tops" },
    { name: "하의", slug: "bottoms" },
    { name: "원피스", slug: "dresses" },
    { name: "액세서리", slug: "accessories" },
  ]

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { name: cat.name, slug: cat.slug },
    })
  }

  console.log("Seed completed!")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
