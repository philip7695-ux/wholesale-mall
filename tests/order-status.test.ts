import { describe, it, expect } from "vitest"
import {
  isValidStatusTransition,
  isPrePayment,
  canBuyerCancel,
} from "@/lib/order-status"

describe("isValidStatusTransition", () => {
  it("정상 흐름은 앞으로 진행 가능", () => {
    expect(isValidStatusTransition("ORDER_PLACED", "STOCK_CHECKING")).toBe(true)
    expect(isValidStatusTransition("CONFIRMED", "INVOICE_SENT")).toBe(true)
    expect(isValidStatusTransition("INVOICE_SENT", "PAYMENT_CONFIRMED")).toBe(true)
    expect(isValidStatusTransition("PAYMENT_CONFIRMED", "SHIPPED")).toBe(true)
  })

  it("조정 단계는 서로 오갈 수 있다(창고↔바이어)", () => {
    expect(isValidStatusTransition("STOCK_CHECKING", "BUYER_REVIEW")).toBe(true)
    expect(isValidStatusTransition("BUYER_REVIEW", "STOCK_CHECKING")).toBe(true)
  })

  it("역방향 진행은 막는다", () => {
    expect(isValidStatusTransition("SHIPPED", "ORDER_PLACED")).toBe(false)
    expect(isValidStatusTransition("PAYMENT_CONFIRMED", "INVOICE_SENT")).toBe(false)
  })

  it("어느 상태에서든 취소 가능", () => {
    expect(isValidStatusTransition("INVOICE_SENT", "CANCELLED")).toBe(true)
    expect(isValidStatusTransition("ORDER_PLACED", "CANCELLED")).toBe(true)
  })

  it("취소는 종결 상태 — 다른 상태로 되돌릴 수 없다", () => {
    expect(isValidStatusTransition("CANCELLED", "ORDER_PLACED")).toBe(false)
    expect(isValidStatusTransition("CANCELLED", "SHIPPED")).toBe(false)
    // 같은 상태(no-op)는 허용된다
    expect(isValidStatusTransition("CANCELLED", "CANCELLED")).toBe(true)
  })
})

describe("isPrePayment (입금 전 단계)", () => {
  it("확정·인보이스까지는 입금 전", () => {
    expect(isPrePayment("ORDER_PLACED")).toBe(true)
    expect(isPrePayment("CONFIRMED")).toBe(true)
    expect(isPrePayment("INVOICE_SENT")).toBe(true)
  })
  it("입금 확인 이후는 아님", () => {
    expect(isPrePayment("PAYMENT_CONFIRMED")).toBe(false)
    expect(isPrePayment("SHIPPED")).toBe(false)
  })
})

describe("canBuyerCancel", () => {
  it("확정 전(조정 단계까지)만 바이어 스스로 취소 가능", () => {
    expect(canBuyerCancel("ORDER_PLACED")).toBe(true)
    expect(canBuyerCancel("BUYER_REVIEW")).toBe(true)
  })
  it("확정 이후엔 바이어가 혼자 취소 불가", () => {
    expect(canBuyerCancel("CONFIRMED")).toBe(false)
    expect(canBuyerCancel("INVOICE_SENT")).toBe(false)
    expect(canBuyerCancel("SHIPPED")).toBe(false)
  })
})
