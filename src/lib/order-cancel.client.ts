/**
 * 어드민이 주문을 없애는 두 단계.
 *
 * 주문을 바로 지우면 바이어 쪽에서는 말없이 사라진다. 왜 없어졌는지 알 길이
 * 없고, 나중에 분쟁이 생겨도 남은 기록이 없다. 그래서 두 단계로 나눈다.
 *
 *   1. 사유와 함께 취소 - 주문은 "취소됨"으로 남고 바이어가 사유를 본다.
 *      동시에 취소 메일이 나간다.
 *   2. 영구 삭제 - 이미 취소된 주문만 지울 수 있다.
 */

/** 사유를 받아 주문을 취소한다. 취소했으면 true. */
export async function cancelOrderWithReason(
  orderId: string,
  prompts: { ask: string; required: string },
): Promise<boolean> {
  const reason = window.prompt(prompts.ask, "")
  // 취소창을 닫은 것과 빈 사유는 다르게 다룬다
  if (reason === null) return false
  if (!reason.trim()) {
    throw new Error(prompts.required)
  }

  const res = await fetch(`/api/orders/${orderId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: reason.trim() }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || "취소에 실패했습니다.")
  }
  return true
}

/** 이미 취소된 주문을 영구 삭제한다. */
export async function purgeOrder(orderId: string): Promise<void> {
  const res = await fetch(`/api/orders/${orderId}?permanent=true`, {
    method: "DELETE",
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || "삭제에 실패했습니다.")
  }
}
