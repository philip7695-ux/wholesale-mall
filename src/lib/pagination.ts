/**
 * 페이지 번호 목록을 줄여서 돌려준다.
 *
 * 상품이 4,000개를 넘어 전체 번호를 다 그리면 목록보다 페이지 번호가
 * 길어진다. 처음·끝·현재 주변만 남기고 사이는 생략 표시로 접는다.
 *
 *   paginationRange(7, 37)  ->  [1, '…', 5, 6, 7, 8, 9, '…', 37]
 *   paginationRange(2, 5)   ->  [1, 2, 3, 4, 5]
 */

export const ELLIPSIS = "…"

export function paginationRange(
  current: number,
  total: number,
  siblings = 2,
): (number | typeof ELLIPSIS)[] {
  // 접어봐야 이득이 없는 길이면 그대로 다 보여준다
  const maxVisible = siblings * 2 + 5
  if (total <= maxVisible) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const left = Math.max(current - siblings, 1)
  const right = Math.min(current + siblings, total)
  const out: (number | typeof ELLIPSIS)[] = []

  // 첫 페이지는 항상 보인다
  out.push(1)
  // 2번이 바로 이어지면 생략 표시 대신 숫자를 넣는 게 낫다
  if (left > 3) out.push(ELLIPSIS)
  else if (left === 3) out.push(2)

  for (let p = Math.max(left, 2); p <= Math.min(right, total - 1); p++) {
    out.push(p)
  }

  if (right < total - 2) out.push(ELLIPSIS)
  else if (right === total - 2) out.push(total - 1)

  out.push(total)
  return out
}
