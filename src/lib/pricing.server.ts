import { prisma } from "@/lib/prisma"
import { seasonIndex } from "@/lib/season"

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

/**
 * 신상 판별 기준선 = 품번에서 읽은 최신 2개 시즌.
 *
 * 서버 시계(new Date)는 배포 환경마다 어긋날 수 있어 믿지 않는다.
 * 올라온 품번의 시즌 중 가장 최신 2개를 신상으로 본다. 새 시즌 품번을
 * 올리면 기준선이 자동으로 올라간다. 문턱(2번째로 최신인 시즌 지수)을
 * 돌려주고, 상품 시즌지수가 이 이상이면 신상이다.
 */
export async function getNewSeasonThreshold(): Promise<number | null> {
  const rows = await prisma.product.findMany({
    where: { isActive: true, seasonKey: { not: null } },
    distinct: ["seasonKey"],
    select: { seasonKey: true },
  })
  const idxs = rows
    .map((r) => seasonIndex(r.seasonKey))
    .filter((n): n is number => n !== null)
    .sort((a, b) => b - a)
  if (idxs.length === 0) return null
  // 최신 2개 시즌을 신상으로: 2번째로 최신인 지수를 문턱으로 삼는다.
  return idxs[Math.min(1, idxs.length - 1)]
}
