import { getEffectiveMoq } from "./grade"

export interface ColorMoqInfo {
  colorId: string
  colorName: string
  moq: number // ProductColor.moq (0이면 Product.colorMoq fallback)
}

export interface MoqCheckInput {
  productMoq: number      // Product.moq
  colorMoq: number        // Product.colorMoq (색상별 기본 MOQ)
  colors: ColorMoqInfo[]  // 각 색상의 MOQ 정보
  quantities: Record<string, number> // colorId → 해당 색상 총 수량
  grade: string
}

export interface ColorError {
  colorId: string
  colorName: string
  required: number
  actual: number
}

export interface MoqCheckResult {
  valid: boolean
  productMoqRequired: number  // 등급 적용된 상품 MOQ
  productQtyTotal: number     // 현재 전체 수량
  colorErrors: ColorError[]   // 색상별 MOQ 미달 목록
}

export function checkMoq(input: MoqCheckInput): MoqCheckResult {
  const { productMoq, colorMoq, colors, quantities, grade } = input

  const productMoqRequired = getEffectiveMoq(productMoq, grade)
  const productQtyTotal = Object.values(quantities).reduce((sum, q) => sum + q, 0)

  const colorErrors: ColorError[] = []

  for (const color of colors) {
    const qty = quantities[color.colorId] || 0
    // 해당 색상을 선택하지 않았으면 검증 건너뜀
    if (qty <= 0) continue

    // 색상 개별 MOQ > 0이면 그 값, 아니면 Product.colorMoq fallback
    const rawColorMoq = color.moq > 0 ? color.moq : colorMoq
    const effectiveColorMoq = getEffectiveMoq(rawColorMoq, grade)

    if (effectiveColorMoq > 0 && qty < effectiveColorMoq) {
      colorErrors.push({
        colorId: color.colorId,
        colorName: color.colorName,
        required: effectiveColorMoq,
        actual: qty,
      })
    }
  }

  const valid =
    (productMoqRequired <= 0 || productQtyTotal >= productMoqRequired) &&
    colorErrors.length === 0

  return { valid, productMoqRequired, productQtyTotal, colorErrors }
}
