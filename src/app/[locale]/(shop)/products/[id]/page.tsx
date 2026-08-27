export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { prisma } from "@/lib/prisma"
import { withDbRetry } from "@/lib/db-retry"
import { ProductDetail } from "@/components/shop/product-detail"
import { auth } from "@/lib/auth"
import { getSeasonRates, getSpecialOfferRate, getNewSeasonThreshold } from "@/lib/pricing.server"
import { getGradeDiscount } from "@/lib/grade.server"
import { buyerPrice, seasonRateFor } from "@/lib/pricing"
import { seasonIndex, seasonKeyFromCode } from "@/lib/season"

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let raw: any = null
  try {
    raw = await withDbRetry(() =>
      prisma.product.findUnique({
        where: { id, isActive: true },
        include: {
          category: true,
          colors: { orderBy: { sortOrder: "asc" } },
          sizes: { orderBy: { sortOrder: "asc" } },
          variants: { include: { color: true, size: true } },
        },
      }),
    )
  } catch (err) {
    // DB 일시 장애로 페이지 전체를 500 으로 떨어뜨리지 않는다.
    // 목록 페이지와 동일하게 안내 후 재시도를 유도한다.
    console.error("[ProductDetailPage] DB error:", err)
    const t = await getTranslations("shop")
    return (
      <div className="py-20 text-center text-gray-400 font-light">
        {t("loadError")}
      </div>
    )
  }

  if (!raw) notFound()

  // 목록·장바구니와 같은 도매가를 보여준다. 여기만 정상가가 나가면
  // 목록에서 본 값과 달라 신뢰를 잃는다.
  const session = await auth().catch(() => null)
  const [seasonRates, gradeRate, specialOfferRate, newThreshold] = await Promise.all([
    getSeasonRates(),
    getGradeDiscount(session?.user?.buyerGrade || "BRONZE").catch(() => 0),
    getSpecialOfferRate(),
    getNewSeasonThreshold().catch(() => null),
  ])
  // 신상 = 품번 시즌지수가 최신 2개 시즌 문턱 이상
  const prodSeasonIdx = seasonIndex(raw.seasonKey ?? seasonKeyFromCode(raw.code))
  const isNew = prodSeasonIdx !== null && newThreshold !== null && prodSeasonIdx >= newThreshold
  const seasonRate = seasonRateFor(raw.code, seasonRates, raw.brand)
  const specialRate = raw.specialOffer ? specialOfferRate : 0

  // Serialize to plain object to avoid Date/Prisma type serialization issues
  const product = {
    id: raw.id,
    name: raw.name,
    code: raw.code,
    description: raw.description,
    thumbnail: raw.thumbnail,
    images: raw.images,
    sizeSpec: raw.sizeSpec,
    material: raw.material,
    origin: raw.origin,
    moq: raw.moq,
    colorMoq: raw.colorMoq,
    priceCurrency: raw.priceCurrency,
    // 신상(현재+다음 시즌)에만 권장 최소 판매가를 안내한다.
    // 시즌이 지나 재고가 되면 자동으로 안 보인다.
    showSrp: isNew,
    category: { name: raw.category.name, slug: raw.category.slug },
    colors: raw.colors.map((c: any) => ({
      id: c.id,
      name: c.name,
      colorCode: c.colorCode,
      hexColor: c.hexColor,
      images: c.images,
      moq: c.moq,
    })),
    sizes: raw.sizes.map((s: any) => ({
      id: s.id,
      name: s.name,
    })),
    variants: raw.variants.map((v: any) => ({
      id: v.id,
      colorId: v.colorId,
      sizeId: v.sizeId,
      price: buyerPrice(v.price, seasonRate, gradeRate, specialRate),
      // 권장 소비자가 = 한국 택가(정상가). 할인 전 원본을 그대로 내린다.
      tagPrice: v.price,
      // 다른 주문이 잡아둔 수량을 뺀 판매 가능 수량을 보여준다
      stock: Math.max(v.stock - v.reserved, 0),
      color: { id: v.color.id, name: v.color.name },
      size: { id: v.size.id, name: v.size.name },
    })),
  }

  return <ProductDetail product={product} />
}
