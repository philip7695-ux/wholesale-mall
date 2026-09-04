import { describe, it, expect } from "vitest"
import ExcelJS from "exceljs"
import { renderSheet } from "@/lib/sheet-style"

// ORD-20260827-H1OMS8 을 본뜬 배치. 전부 취소된 스타일 하나와,
// 한 치수만 취소된 스타일 하나를 함께 둔다.
describe("패킹리스트 취소 표시", () => {
  it("전체 취소 줄은 통째로, 일부 취소는 그 칸만 그어진다", async () => {
    const buf = await renderSheet({
      summary: { sheetName: "주문요약", title: "패킹리스트", rows: [["총 수량", 17], ["취소 항목", "2건 (주문 19장 → 출고 17장)"]] },
      sheetName: "상품목록",
      title: "패킹리스트  ORD-20260827-H1OMS8",
      subtitle: "",
      notice: "※ 붉게 그은 칸은 바이어가 취소한 항목입니다. 출고에서 빼주세요.",
      header: ["상품코드", "상품명", "컬러", "90", "100", "합계", "단가", "소계"],
      rows: [
        { 상품코드: "BP43PD703", 상품명: "sweatpants", 컬러: "Ivory", "90": 0, "100": "", 합계: 0, 단가: 13650, 소계: 0,
          __cancelled: true, __cancelledSizes: new Set(["90"]) },
        { 상품코드: "BP44PD744", 상품명: "fleece pants", 컬러: "Brown", "90": 0, "100": 1, 합계: 1, 단가: 17150, 소계: 17150,
          __cancelled: false, __cancelledSizes: new Set(["90"]) },
      ],
      cancelled: (row, col) =>
        Boolean(row.__cancelled) || ((row.__cancelledSizes as Set<string> | undefined)?.has(col) ?? false),
    })
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet("상품목록")!

    // 전체 취소 줄: 상품코드까지 그어진다
    expect(ws.getRow(5).getCell(1).font?.strike).toBe(true)
    expect(ws.getRow(5).getCell(6).font?.strike).toBe(true)

    // 일부 취소 줄: 90 칸만 그어지고 상품코드·100 칸은 멀쩡
    expect(ws.getRow(6).getCell(1).font?.strike).toBeFalsy()
    expect(ws.getRow(6).getCell(4).font?.strike).toBe(true)  // 90
    expect(ws.getRow(6).getCell(5).font?.strike).toBeFalsy() // 100
    expect(ws.getRow(6).getCell(4).value).toBe(0)
    expect(ws.getRow(6).getCell(5).value).toBe(1)

    // 요약 시트에 취소 건수가 남는다
    expect(wb.getWorksheet("주문요약")!.getRow(4).getCell(2).value).toContain("2건")
  })
})
