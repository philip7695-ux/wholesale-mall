import { prisma } from "@/lib/prisma"

/**
 * 시즌별 할인율 조회.
 *
 * 목록 한 페이지에 여러 시즌이 섞이므로 상품마다 조회하지 않고
 * 한 번에 받아 맵으로 쓴다. 16개 남짓이라 통째로 가져와도 가볍다.
 */
export async function getSeasonRates(): Promise<Record<string, number>> {
  try {
    const rows = await prisma.seasonDiscount.findMany({
      select: { seasonKey: true, rate: true },
    })
    return Object.fromEntries(rows.map((r) => [r.seasonKey, r.rate]))
  } catch {
    // 설정을 못 읽으면 할인 없이(정상가) 보여준다. 싸게 파는 것보다
    // 비싸게 보이는 쪽이 되돌리기 쉽다.
    return {}
  }
}

/**
 * 스페셜 오퍼 추가 할인율. 설정을 못 읽으면 0(추가 할인 없음)으로 둔다.
 * 못 읽었다고 더 깎아 팔면 되돌리기 어렵다.
 */
export async function getSpecialOfferRate(): Promise<number> {
  try {
    const cfg = await prisma.storeConfig.findUnique({
      where: { id: "default" },
      select: { specialOfferRate: true },
    })
    return cfg?.specialOfferRate ?? 0
  } catch {
    return 0
  }
}
