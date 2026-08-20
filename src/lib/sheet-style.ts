import ExcelJS from "exceljs"

/**
 * 표처럼 보이는 엑셀을 만든다.
 *
 * 값만 있는 시트는 어디까지가 표인지 알 수 없어 창고에서 읽기 어렵다.
 * 테두리, 머리글 배경, 틀고정, 숫자 가운데정렬을 넣어 종이 발주서에
 * 가깝게 만든다.
 *
 * xlsx(SheetJS) 무료판은 셀 서식을 넣지 못해 exceljs 를 쓴다.
 * 읽기는 여전히 xlsx 로 한다. 서식이 필요 없고 이미 잘 돌고 있다.
 *
 * 표는 4행부터 놓는다. 1~3행은 제목과 안내문 자리다.
 * 읽는 쪽은 "품번"이 있는 줄을 찾으므로 이 위치에 기대지 않는다.
 */

const HEADER_ROW = 4

const GRAY_LINE = "FFD0D0D0"
const HEADER_BG = "FFEFEFEF"
const FILLABLE_BG = "FFFFF9E6"
const TOTAL_BG = "FFF5F5F5"

const thin: ExcelJS.Border = { style: "thin", color: { argb: GRAY_LINE } }
const boxed: Partial<ExcelJS.Borders> = {
  top: thin,
  left: thin,
  bottom: thin,
  right: thin,
}

export async function renderSheet({
  sheetName,
  title,
  subtitle,
  notice,
  header,
  rows,
  fillableColumns = [],
}: {
  sheetName: string
  title: string
  subtitle: string
  notice: string
  header: string[]
  rows: Record<string, unknown>[]
  /** 상대가 채워 넣어야 하는 열. 옅게 칠해 표시한다. */
  fillableColumns?: string[]
}): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: "frozen", xSplit: 3, ySplit: HEADER_ROW }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })

  const lastCol = header.length
  const fillable = new Set(fillableColumns)

  // 1~3행: 제목과 안내문
  ws.mergeCells(1, 1, 1, Math.min(lastCol, 6))
  const titleCell = ws.getCell(1, 1)
  titleCell.value = title
  titleCell.font = { size: 14, bold: true }

  ws.mergeCells(2, 1, 2, Math.min(lastCol, 8))
  const subCell = ws.getCell(2, 1)
  subCell.value = subtitle
  subCell.font = { size: 10, color: { argb: "FF666666" } }

  ws.mergeCells(3, 1, 3, Math.min(lastCol, 8))
  const noticeCell = ws.getCell(3, 1)
  noticeCell.value = notice
  noticeCell.font = { size: 10, bold: true, color: { argb: "FFB45309" } }

  ws.getRow(1).height = 22
  ws.getRow(3).height = 18

  // 머리글
  const headerRow = ws.getRow(HEADER_ROW)
  headerRow.values = header
  headerRow.height = 20
  header.forEach((name, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.font = { bold: true, size: 10 }
    cell.alignment = { horizontal: "center", vertical: "middle" }
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } }
    cell.border = { ...boxed, bottom: { style: "medium", color: { argb: "FF999999" } } }
    // 채워 넣어야 하는 열은 머리글부터 표시해 둔다
    if (fillable.has(name)) {
      cell.font = { bold: true, size: 10, color: { argb: "FFB45309" } }
    }
  })

  // 본문
  rows.forEach((r, ri) => {
    const row = ws.getRow(HEADER_ROW + 1 + ri)
    row.values = header.map((h) => {
      const v = r[h]
      if (v === "" || v === undefined || v === null) return null
      return typeof v === "number" ? v : String(v)
    })
    // 마지막 줄이 합계면 굵게 칠한다
    const isTotal = String(r["품번"] ?? "") === "합계"

    header.forEach((name, i) => {
      const cell = row.getCell(i + 1)
      cell.border = boxed
      cell.font = { size: 10, bold: isTotal }
      cell.alignment = {
        horizontal: typeof cell.value === "number" ? "center" : "left",
        vertical: "middle",
      }
      if (isTotal) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_BG } }
        cell.border = { ...boxed, top: { style: "medium", color: { argb: "FF999999" } } }
      } else if (fillable.has(name)) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FILLABLE_BG } }
      }
    })
  })

  // 열 너비. 내용 길이에 맞추되 사이즈 칸은 좁게 고정해 표가 옆으로
  // 늘어지지 않게 한다.
  header.forEach((name, i) => {
    const isNarrow = fillable.has(name) && name.length <= 4
    const maxLen = Math.max(
      name.length * 2,
      ...rows.map((r) => String(r[name] ?? "").length),
    )
    ws.getColumn(i + 1).width = isNarrow ? 7 : Math.min(Math.max(maxLen + 3, 8), 28)
  })

  // exceljs 는 ArrayBuffer 를 돌려준다. Response 본문으로 그대로 쓸 수 있다.
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}
