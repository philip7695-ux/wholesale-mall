import { describe, it, expect } from "vitest"
import ExcelJS from "exceljs"
import { renderSheet } from "@/lib/sheet-style"

describe("발주서 취소 표시", () => {
  it("세로형: 취소된 줄이 붉게 그어진다", async () => {
    const buf = await renderSheet({
      sheetName: "발주서(사이즈 세로)",
      title: "발주서  ORD-TEST",
      subtitle: "품목: 1개 (취소 1개)",
      notice: "실물 확인 후 확인수량 칸을 채워서 회신해 주세요.  ※ 붉게 그은 칸은 바이어가 취소한 항목입니다. 준비에서 빼주세요.",
      header: ["품번", "상품명", "컬러", "사이즈", "주문수량", "확인수량", "비고"],
      rows: [
        { 품번: "BP43AH304", 상품명: "Puppy corduroy camp cap", 컬러: "SC", 사이즈: "F", 주문수량: 6, 확인수량: "", 비고: "", __cancelled: false },
        { 품번: "BP43PD703", 상품명: "All over looney tunes baby sweatpants", 컬러: "IV", 사이즈: "90", 주문수량: 0, 확인수량: 0, 비고: "바이어 취소 — 준비에서 빼주세요", __cancelled: true },
      ],
      fillableColumns: ["확인수량", "비고"],
      cancelled: (row) => Boolean(row.__cancelled),
    })
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet("발주서(사이즈 세로)")!
    const normal = ws.getRow(5).getCell(1)
    const dropped = ws.getRow(6).getCell(1)
    expect(normal.font?.strike).toBeFalsy()
    expect(dropped.font?.strike).toBe(true)
    expect(dropped.font?.color?.argb).toBe("FFC02626")
    expect((dropped.fill as ExcelJS.FillPattern)?.fgColor?.argb).toBe("FFFDECEC")
    expect(ws.getRow(6).getCell(5).value).toBe(0)
    expect(ws.getRow(6).getCell(7).value).toContain("바이어 취소")
  })

  it("가로형: 취소된 사이즈 칸만 그어진다", async () => {
    const buf = await renderSheet({
      sheetName: "발주서(사이즈 가로)",
      title: "발주서  ORD-TEST",
      subtitle: "",
      notice: "",
      header: ["품번", "상품명", "컬러", "85", "90", "주문합계", "비고"],
      rows: [
        { 품번: "BP43PD703", 상품명: "sweatpants", 컬러: "IV", "85": 2, "90": 0, 주문합계: 2, 비고: "", __cancelledSizes: new Set(["90"]) },
      ],
      cancelled: (row, col) => (row.__cancelledSizes as Set<string> | undefined)?.has(col) ?? false,
    })
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    const ws = wb.getWorksheet("발주서(사이즈 가로)")!
    expect(ws.getRow(5).getCell(4).font?.strike).toBeFalsy()   // 85
    expect(ws.getRow(5).getCell(5).font?.strike).toBe(true)     // 90
    expect(ws.getRow(5).getCell(5).value).toBe(0)
    expect(ws.getRow(5).getCell(1).font?.strike).toBeFalsy()    // 품번은 멀쩡
  })
})
