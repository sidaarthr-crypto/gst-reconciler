import * as XLSX from "xlsx"

import type { ReconciliationRow, ReconciliationSummary } from "@/lib/types"
import { getITCDeadlineInfo, getMonthName } from "@/lib/utils"

const HEADER_BG = "0F1629"
const HEADER_FG = "FFFFFF"

const RISK_STYLES: Record<
  string,
  { fill: string; font: string }
> = {
  Critical: { fill: "FEF2F2", font: "DC2626" },
  High: { fill: "FFF7ED", font: "EA580C" },
  Medium: { fill: "FFFBEB", font: "D97706" },
  Low: { fill: "E0F2FE", font: "0369A1" },
  Safe: { fill: "F0FDF4", font: "16A34A" },
}

const DEADLINE_COL_INDEX = 18

function styleCell(rgbFill: string, rgbFont: string) {
  return {
    fill: { patternType: "solid" as const, fgColor: { rgb: rgbFill } },
    font: { bold: true, color: { rgb: rgbFont } },
  }
}

function applyRowStyle(ws: XLSX.WorkSheet, rowIdx0: number, risk: string, colCount: number) {
  const palette = RISK_STYLES[risk] ?? RISK_STYLES.Medium
  for (let c = 0; c < colCount; c++) {
    if (c === DEADLINE_COL_INDEX) continue
    const addr = XLSX.utils.encode_cell({ r: rowIdx0, c })
    const cell = ws[addr] as XLSX.CellObject | undefined
    if (!cell) continue
    cell.s = styleCell(palette.fill, palette.font)
  }
}

/** ITC Deadline (Sec 16(4)) column text — never "N/A" for expired rows when invoice date exists. */
function formatDeadlineForExport(row: ReconciliationRow): string {
  if (row.isDeadlineExpired) {
    const fromRow = row.itcClaimDeadline?.trim()
    const fromInv =
      !fromRow && row.invoiceDate?.trim()
        ? getITCDeadlineInfo(row.invoiceDate.trim())?.deadlineStr
        : null
    const label = fromRow || fromInv
    return label ? `EXPIRED - ${label}` : "EXPIRED"
  }
  if (row.isDeadlineWarning && !row.isDeadlineExpired && row.itcClaimDeadline) {
    return `${row.daysToDeadline ?? 0} days - ${row.itcClaimDeadline}`
  }
  if (row.itcClaimDeadline) {
    return `${row.itcClaimDeadline} (${row.daysToDeadline ?? 0} days)`
  }
  return "N/A"
}

/** Deadline column fill follows row risk; font is red (expired) or amber (warning). */
function deadlineColumnCellStyle(row: ReconciliationRow) {
  const palette = RISK_STYLES[row.itcRisk] ?? RISK_STYLES.Medium
  let fontRgb = "FF000000"
  if (row.isDeadlineExpired) fontRgb = "FFDC2626"
  else if (row.isDeadlineWarning && !row.isDeadlineExpired && row.itcClaimDeadline)
    fontRgb = "FFD97706"
  return {
    fill: { patternType: "solid" as const, fgColor: { rgb: palette.fill } },
    font: { bold: true, color: { rgb: fontRgb } },
  }
}

const REPORT_HEADERS = [
  "Risk",
  "Status",
  "GSTIN",
  "Supplier",
  "Invoice No",
  "Date",
  "POS",
  "Taxable 2B",
  "Taxable PR",
  "Taxable Diff",
  "IGST 2B",
  "IGST PR",
  "CGST 2B",
  "CGST PR",
  "SGST 2B",
  "SGST PR",
  "ITC Avl",
  "ITC At Risk",
  "ITC Deadline (Sec 16(4))",
  "Recommended Action",
  "Urgency",
] as const

export function exportReconciliationWorkbook(params: {
  month: number
  year: number
  requestId: string
  gstr2bFilename: string
  prFilename: string
  summary: ReconciliationSummary
  rows: ReconciliationRow[]
}): void {
  const { month, year, requestId, gstr2bFilename, prFilename, summary, rows } =
    params

  const monthLabel = getMonthName(month).replace(/\s+/g, "")
  const safeRequestId = requestId.replace(/[/\\?%*:|"<>]/g, "-")
  const filename = `GSTRecon_${monthLabel}_${year}_${safeRequestId}.xlsx`

  const wb = XLSX.utils.book_new()
  wb.Props = { Title: "GSTRecon Reconciliation", Author: "GSTRecon" }

  const dataRows = rows.map((r) => [
    r.itcRisk,
    r.status,
    r.supplierGSTIN,
    r.supplierName,
    r.invoiceNumber,
    r.invoiceDate,
    r.placeOfSupply,
    r.taxable2B ?? "",
    r.taxablePR ?? "",
    r.taxableDiff ?? "",
    r.igst2B ?? "",
    r.igstPR ?? "",
    r.cgst2B ?? "",
    r.cgstPR ?? "",
    r.sgst2B ?? "",
    r.sgstPR ?? "",
    r.itcAvailable ?? "",
    r.totalITCAtRisk,
    formatDeadlineForExport(r),
    r.recommendedAction,
    r.actionUrgency,
  ])

  const aoa = [REPORT_HEADERS as unknown as string[], ...dataRows]
  const ws = XLSX.utils.aoa_to_sheet(aoa)

  const colCount = REPORT_HEADERS.length
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    const cell = ws[addr]
    if (cell) {
      cell.s = styleCell(HEADER_BG, HEADER_FG)
    }
  }

  for (let i = 0; i < rows.length; i++) {
    applyRowStyle(ws, i + 1, rows[i].itcRisk, colCount)
    const dAddr = XLSX.utils.encode_cell({ r: i + 1, c: DEADLINE_COL_INDEX })
    const dCell = ws[dAddr] as XLSX.CellObject | undefined
    if (dCell) {
      dCell.s = deadlineColumnCellStyle(rows[i])
    }
  }

  ws["!cols"] = REPORT_HEADERS.map((h) =>
    h.includes("ITC Deadline") ? { wch: 18 } : { wch: 16 },
  )
  ws["!views"] = [{ state: "frozen", ySplit: 1, topLeftCell: "A2", activeCell: "A2" }]

  XLSX.utils.book_append_sheet(wb, ws, "Reconciliation Report")

  const generatedAt = new Date().toISOString()
  const summaryAoa = [
    ["Request ID", requestId],
    ["Period", `${getMonthName(month)} ${year}`],
    ["GSTR-2B file", gstr2bFilename],
    ["Purchase Register file", prFilename],
    [],
    ["Metric", "Value"],
    ["Total invoices", summary.totalInvoices],
    ["Matched", summary.matchedCount],
    ["Value mismatch", summary.valueMismatchCount],
    ["In 2B only", summary.in2BOnlyCount],
    ["In PR only", summary.inPROnlyCount],
    ["QRMP delay (monitor)", summary.qrmpCount ?? 0],
    [],
    ["Total ITC at risk", summary.totalITCAtRisk],
    ["Total ITC safe (matched)", summary.totalITCSafe],
    [],
    ["ITC Deadline Alerts:", ""],
    ["Expired:", summary.deadlineExpiredCount],
    ["Warning (<60 days):", summary.deadlineWarningCount],
    [],
    ["Generated at", generatedAt],
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(summaryAoa)
  ws2["!cols"] = [{ wch: 28 }, { wch: 48 }]
  const riskCell = XLSX.utils.encode_cell({ r: 12, c: 1 })
  if (ws2[riskCell]) {
    ;(ws2[riskCell] as XLSX.CellObject).s = styleCell("FEF2F2", "DC2626")
  }
  const safeCell = XLSX.utils.encode_cell({ r: 13, c: 1 })
  if (ws2[safeCell]) {
    ;(ws2[safeCell] as XLSX.CellObject).s = styleCell("F0FDF4", "16A34A")
  }
  XLSX.utils.book_append_sheet(wb, ws2, "Summary")

  XLSX.writeFile(wb, filename, { cellStyles: true })
}
