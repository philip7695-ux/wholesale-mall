import type { Prisma, PrismaClient } from "@prisma/client"

/**
 * 주문 확정 전까지의 수량 조정과 재고 예약.
 *
 * 흐름
 *   주문접수 → 재고확인중(관리자 조정) → 바이어확인중(바이어 조정) → 확정
 *   가운데 두 단계는 여러 번 오갈 수 있다. 한 번에 안 끝나는 경우가 많다.
 *
 * 재고
 *   주문 시점에는 reserved 만 올린다. 확정될 때 stock 에서 뺀다.
 *   그 사이에 수량이 오르내리면 reserved 만 따라 움직인다.
 *   취소하면 reserved 만 풀리고 실재고는 건드리지 않는다.
 *
 *   몰의 재고는 주 1회 갱신되는 참고값이다(본사 영업이 같은 재고를
 *   따로 판다). 예약은 몰 안에서의 중복 주문만 막는다. 실제 수량은
 *   창고 확인으로 정해지므로, 조정 과정에서 예약이 재고를 넘어설 수 있다.
 *   그건 오류가 아니라 정상이며, 확정 시 실재고가 음수가 되지 않도록만 막는다.
 */

export type Tx = Prisma.TransactionClient | PrismaClient

/** 관리자·바이어가 수량을 고칠 수 있는 상태 */
export const EDITABLE_STATUSES = ["ORDER_PLACED", "STOCK_CHECKING", "BUYER_REVIEW"] as const

/** 예약이 잡혀 있는 상태. 여기서 벗어나면 예약을 풀거나 실재고로 넘긴다. */
export const RESERVED_STATUSES = ["ORDER_PLACED", "STOCK_CHECKING", "BUYER_REVIEW"] as const

export function isEditable(status: string): boolean {
  return (EDITABLE_STATUSES as readonly string[]).includes(status)
}

export function holdsReservation(status: string): boolean {
  return (RESERVED_STATUSES as readonly string[]).includes(status)
}

/** 한 항목의 수량을 바꾸면서 예약도 같은 폭으로 옮긴다. */
export async function adjustReservation(tx: Tx, variantId: string | null, delta: number) {
  if (!variantId || delta === 0) return
  // 예약이 음수가 되지 않게 막는다. 어긋난 데이터가 쌓이면 판매 가능 수량이 부풀려진다.
  await tx.$executeRaw`
    update mall."ProductVariant"
    set reserved = greatest(reserved + ${delta}, 0), "updatedAt" = now()
    where id = ${variantId}`
}

/** 주문의 예약을 전부 푼다(취소). 실재고는 건드리지 않는다. */
export async function releaseReservation(tx: Tx, orderId: string) {
  await tx.$executeRaw`
    update mall."ProductVariant" v
    set reserved = greatest(v.reserved - i.qty, 0), "updatedAt" = now()
    from (
      select "variantId", sum(quantity)::int qty
      from mall."OrderItem"
      where "orderId" = ${orderId} and "variantId" is not null
      group by 1
    ) i
    where v.id = i."variantId"`
}

/**
 * 확정: 예약을 실재고 차감으로 바꾼다.
 * 실재고가 모자라도 음수로 내려가지 않게 막는다. 몰의 재고는 참고값이라
 * 창고에서 확인한 수량이 전산보다 클 수 있다.
 */
export async function commitReservation(tx: Tx, orderId: string) {
  await tx.$executeRaw`
    update mall."ProductVariant" v
    set stock = greatest(v.stock - i.qty, 0),
        reserved = greatest(v.reserved - i.qty, 0),
        "updatedAt" = now()
    from (
      select "variantId", sum(quantity)::int qty
      from mall."OrderItem"
      where "orderId" = ${orderId} and "variantId" is not null
      group by 1
    ) i
    where v.id = i."variantId"`
}

/** 목록 정렬·노출에 쓰는 상품 단위 값을 판매 가능 기준으로 다시 계산한다. */
export async function refreshProductStock(tx: Tx, productIds: string[]) {
  if (!productIds.length) return
  await tx.$executeRaw`
    update mall."Product" p set
      "inStock" = exists (
        select 1 from mall."ProductVariant" v
        where v."productId" = p.id and v.stock - v.reserved > 0
      ),
      "totalStock" = coalesce((
        select sum(greatest(v.stock - v.reserved, 0))::int
        from mall."ProductVariant" v where v."productId" = p.id
      ), 0)
    where p.id = any(${productIds})`
}
