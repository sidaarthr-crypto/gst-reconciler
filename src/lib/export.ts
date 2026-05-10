import * as XLSX from "xlsx-js-style"

import type {
  ITCRiskLevel,
  MismatchStatus,
  ReconciliationRow,
  ReconciliationSummary,
} from "@/lib/types"
import { formatINR, getMonthName } from "@/lib/utils"

/** Excel ARGB without alpha prefix variants — styles use FFFFFF style RGB in fork */
const FF = (rgb: string) => (rgb.startsWith("FF") ? rgb : `FF${rgb.replace(/^#/, "")}`)

const EXPORT_STATUS_ORDER: readonly MismatchStatus[] = [
  "Sec 16(4) Expired",
  "ITC Blocked",
  "Debit Note Misclassified",
  "Duplicate",
  "In PR Only",
  "In 2B Only",
  "Value Mismatch",
  "Tax Type Mismatch",
  "Tax Rate Mismatch",
  "POS Mismatch",
  "ITC Reduced by Supplier",
  "Unclaimed ITC",
  "ITC Eligibility Uncertain",
  "Partially Booked ITC",
  "CESS Mismatch",
  "Period Timing Mismatch",
  "QRMP Delay",
  "RCM Invoice",
  "ITC Temporary",
  "Suggested Match",
  "Date Gap Match",
  "Group Entity Match",
  "GSTIN Mismatch Match",
  "Amount-Led Match",
  "Consolidated Invoice Match",
  "Probable Month Match",
  "Non-GST Entry",
  "Matched",
] as const

const STATUS_DESCRIPTIONS: Record<MismatchStatus, string> = {
  "Sec 16(4) Expired":
    "Invoices where the ITC claim deadline under Section 16(4) has expired.",
  "ITC Blocked":
    "Invoices where ITC is permanently or conditionally blocked under Section 17(5).",
  "Debit Note Misclassified":
    "Portal and books disagree on debit vs credit note classification.",
  Duplicate: "Invoice appears more than once — risk of double-claiming ITC.",
  "In PR Only":
    "Invoice in Purchase Register but missing from GSTR-2B (supplier not filed).",
  "In 2B Only":
    "Invoice in GSTR-2B but missing from Purchase Register.",
  "Value Mismatch":
    "Taxable value or tax differs between GSTR-2B and Purchase Register.",
  "Tax Type Mismatch":
    "IGST vs CGST/SGST mismatch — inter/intrastate classification error.",
  "Tax Rate Mismatch": "Tax rate % differs between portal and books.",
  "POS Mismatch":
    "Place of Supply inconsistency with tax component pattern.",
  "ITC Reduced by Supplier":
    "Supplier filed a lower ITC than what your books show.",
  "Unclaimed ITC":
    "Eligible ITC in GSTR-2B not yet booked in Purchase Register.",
  "ITC Eligibility Uncertain":
    "Invoice involves goods/services that may be restricted under Section 17(5).",
  "Partially Booked ITC":
    "ITC booked in books is significantly lower than portal amount.",
  "CESS Mismatch":
    "CESS amount differs between GSTR-2B and Purchase Register.",
  "Period Timing Mismatch":
    "Invoice date is 1–2 months before this period — supplier may file late.",
  "QRMP Delay":
    "Quarterly-filing supplier; invoice expected in next quarter GSTR-2B.",
  "RCM Invoice":
    "Reverse Charge invoice — ITC claimed via GSTR-3B Table 4D, not portal.",
  "ITC Temporary":
    "ITC temporarily unavailable — monitor next month's GSTR-2B.",
  "Suggested Match":
    "Invoice numbers differ but amounts match — possible formatting variant.",
  "Date Gap Match":
    "Invoice dates differ significantly between portal and books.",
  "Group Entity Match":
    "Same PAN, different state GSTIN — likely group entity supply.",
  "GSTIN Mismatch Match":
    "Invoice number and amount match but supplier GSTINs differ.",
  "Amount-Led Match":
    "GST amounts match but invoice numbers differ — possible formatting variant.",
  "Consolidated Invoice Match":
    "Single book entry matched to multiple portal invoices.",
  "Probable Month Match":
    "Same supplier, same month, matching GST — different invoice number.",
  "Non-GST Entry":
    "No GSTIN and zero tax — excluded from GST reconciliation scope.",
  Matched: "Fully reconciled invoices. Safe to claim ITC in GSTR-3B.",
}

const RISK_BADGE: Record<
  ITCRiskLevel,
  { fill: string; font: string }
> = {
  Critical: { fill: "C0392B", font: "FFFFFF" },
  High: { fill: "E67E22", font: "FFFFFF" },
  Medium: { fill: "F39C12", font: "1A1A1A" },
  Low: { fill: "27AE60", font: "FFFFFF" },
  Safe: { fill: "2980B9", font: "FFFFFF" },
  None: { fill: "95A5A6", font: "FFFFFF" },
}

const URGENCY_BADGE: Record<
  ReconciliationRow["actionUrgency"],
  { fill: string; font: string }
> = {
  Immediate: { fill: "C0392B", font: "FFFFFF" },
  "Before Filing": { fill: "E67E22", font: "FFFFFF" },
  Monitor: { fill: "27AE60", font: "FFFFFF" },
  None: { fill: "95A5A6", font: "FFFFFF" },
}

const RISK_RANK: Record<ITCRiskLevel, number> = {
  Critical: 6,
  High: 5,
  Medium: 4,
  Low: 3,
  Safe: 2,
  None: 1,
}

const DETAIL_HEADERS = [
  "Supplier GSTIN",
  "Supplier Name",
  "Invoice No.",
  "Invoice Date",
  "Taxable Value (2B)",
  "IGST (2B)",
  "CGST (2B)",
  "SGST (2B)",
  "Taxable Value (PR)",
  "IGST (PR)",
  "CGST (PR)",
  "SGST (PR)",
  "ITC Available",
  "Status",
  "ITC Risk",
  "Urgency",
  "Action Required",
  "ITC at Risk (₹)",
] as const

/** Detail sheet numeric column indices (0-based) */
const DETAIL_NUM_COLS = new Set([4, 5, 6, 7, 8, 9, 10, 11, 17])

const DETAIL_COL_WIDTHS = [
  20, 26, 18, 13, 16, 12, 12, 12, 16, 12, 12, 12, 12, 22, 12, 14, 52, 16,
]

const SUMMARY_COL_WIDTHS = [{ wch: 3 }, { wch: 32 }, { wch: 18 }, { wch: 20 }, { wch: 18 }]

const NF_RUPEE = "₹#,##0"
const NF_INT = "#,##0"

function thinBorder() {
  const e = { style: "thin" as const, color: { rgb: FF("D0D8E4") } }
  return { top: e, bottom: e, left: e, right: e }
}

function baseFont(size: number, bold = false, colorRgb?: string) {
  return {
    name: "Arial",
    sz: size,
    bold,
    ...(colorRgb ? { color: { rgb: FF(colorRgb) } } : {}),
  }
}

function setCell(
  ws: XLSX.WorkSheet,
  r: number,
  c: number,
  v: string | number | null | undefined,
  s?: XLSX.CellStyle,
  t?: XLSX.ExcelDataType,
) {
  const addr = XLSX.utils.encode_cell({ r, c })
  let cellType: XLSX.ExcelDataType = "s"
  let val: string | number = ""
  if (typeof v === "number" && !Number.isNaN(v)) {
    cellType = "n"
    val = v
  } else if (v === null || v === undefined) {
    cellType = "s"
    val = ""
  } else {
    cellType = "s"
    val = String(v)
  }
  const cell: XLSX.CellObject = { t: t ?? cellType, v: val, ...(s ? { s } : {}) }
  ws[addr] = cell
}

function merge(ws: XLSX.WorkSheet, r0: number, c0: number, r1: number, c1: number) {
  if (!ws["!merges"]) ws["!merges"] = []
  ws["!merges"].push({ s: { r: r0, c: c0 }, e: { r: r1, c: c1 } })
}

function worstRisk(rows: ReconciliationRow[]): ITCRiskLevel {
  let best: ITCRiskLevel = "None"
  let rank = 0
  for (const row of rows) {
    const rr = RISK_RANK[row.itcRisk]
    if (rr > rank) {
      rank = rr
      best = row.itcRisk
    }
  }
  return best
}

function groupRowsByStatus(
  rows: ReconciliationRow[],
): Map<MismatchStatus, ReconciliationRow[]> {
  const map = new Map<MismatchStatus, ReconciliationRow[]>()
  for (const row of rows) {
    const list = map.get(row.status)
    if (list) list.push(row)
    else map.set(row.status, [row])
  }
  return map
}

function hideGridlines(ws: XLSX.WorkSheet) {
  ;(ws as XLSX.WorkSheet & { "!sheetView"?: { showGridLines: boolean } })[
    "!sheetView"
  ] = { showGridLines: false }
}

function riskBadgeStyle(level: ITCRiskLevel): XLSX.CellStyle {
  const b = RISK_BADGE[level]
  return {
    font: baseFont(8, true, b.font),
    fill: { patternType: "solid", fgColor: { rgb: FF(b.fill) } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: thinBorder(),
  }
}

function urgencyBadgeStyle(u: ReconciliationRow["actionUrgency"]): XLSX.CellStyle {
  const b = URGENCY_BADGE[u]
  return {
    font: baseFont(8, true, b.font),
    fill: { patternType: "solid", fgColor: { rgb: FF(b.fill) } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: thinBorder(),
  }
}

function itcAtRiskStyle(amount: number): XLSX.CellStyle {
  const red = amount > 0
  return {
    font: baseFont(9, true, red ? "C0392B" : "555555"),
    alignment: { horizontal: "right", vertical: "center" },
    border: thinBorder(),
  }
}

function buildSummarySheet(params: {
  month: number
  year: number
  requestId: string
  gstr2bFilename: string
  prFilename: string
  summary: ReconciliationSummary
  rows: ReconciliationRow[]
}): XLSX.WorkSheet {
  const { month, year, requestId, gstr2bFilename, prFilename, summary, rows } =
    params
  const ws: XLSX.WorkSheet = {}
  const byStatus = groupRowsByStatus(rows)
  const statusesWithData = EXPORT_STATUS_ORDER.filter(
    (s) => (byStatus.get(s)?.length ?? 0) > 0,
  )

  const periodLabel = `${getMonthName(month)} ${year}`
  const generatedAt = new Date().toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  })

  const SUMMARY_TABLE_HEADER_R = 13

  // Row 0: banner (merge B–E)
  setCell(
    ws,
    0,
    1,
    "GSTRecon — GSTR-2B Reconciliation Report",
    {
      font: { name: "Arial", sz: 16, bold: true, color: { rgb: FF("FFFFFF") } },
      fill: { patternType: "solid", fgColor: { rgb: FF("1A3557") } },
      alignment: { horizontal: "center", vertical: "center", wrapText: false },
    },
  )
  merge(ws, 0, 1, 0, 4)

  // Row 1 spacer
  ws["!rows"] = ws["!rows"] || []
  ws["!rows"][0] = { hpt: 45 }
  ws["!rows"][1] = { hpt: 8 }

  // Rows 2–6 metadata (Request ID … Generated At) — columns B label, C:D value
  const metaRows: [string, string][] = [
    ["Request ID", requestId],
    ["Period", periodLabel],
    ["GSTR-2B File", gstr2bFilename],
    ["Purchase Register", prFilename],
    ["Generated At", generatedAt],
  ]
  for (let i = 0; i < metaRows.length; i++) {
    const r = 2 + i
    ws["!rows"][r] = { hpt: 18 }
    const [label, value] = metaRows[i]
    setCell(ws, r, 1, label, {
      font: baseFont(9, true, "1A3557"),
      fill: { patternType: "solid", fgColor: { rgb: FF("EEF3FB") } },
      alignment: { horizontal: "left", vertical: "center" },
      border: thinBorder(),
    })
    setCell(ws, r, 2, value, {
      font: baseFont(9, false, "000000"),
      fill: { patternType: "solid", fgColor: { rgb: FF("FFFFFF") } },
      alignment: { horizontal: "left", vertical: "center", wrapText: true },
      border: thinBorder(),
    })
    merge(ws, r, 2, r, 3)
  }

  ws["!rows"][7] = { hpt: 8 }

  // KPI tiles r8–r11, cols B–D (indices 1–3)
  type KpiKey =
    | "invoices"
    | "matched"
    | "itcRisk"
    | "itcSafe"
    | "issues"
    | "qrmp"

  const kpiDefs: {
    key: KpiKey
    label: string
    accent: string
    value: string | number
  }[][] = [
    [
      {
        key: "invoices",
        label: "Total Invoices",
        accent: "1A3557",
        value: summary.totalInvoices,
      },
      {
        key: "matched",
        label: "Matched (Safe)",
        accent: "27AE60",
        value: summary.matchedCount,
      },
      {
        key: "itcRisk",
        label: "Total ITC at Risk",
        accent: "C0392B",
        value: formatINR(summary.totalITCAtRisk),
      },
    ],
    [
      {
        key: "itcSafe",
        label: "ITC Safe",
        accent: "2980B9",
        value: formatINR(summary.totalITCSafe),
      },
      {
        key: "issues",
        label: "Issues Found",
        accent: "E67E22",
        value: summary.issuesFoundCount,
      },
      {
        key: "qrmp",
        label: "QRMP (Monitor)",
        accent: "8E44AD",
        value: summary.qrmpCount ?? 0,
      },
    ],
  ]

  const kpiLabelRow = 8
  const kpiValueRow = 9
  const kpiLabelRow2 = 10
  const kpiValueRow2 = 11

  for (let col = 0; col < 3; col++) {
    const d = kpiDefs[0][col]
    setCell(ws, kpiLabelRow, 1 + col, d.label, {
      font: { name: "Arial", sz: 8, bold: true, color: { rgb: FF("FFFFFF") } },
      fill: { patternType: "solid", fgColor: { rgb: FF(d.accent) } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
    })
    const vStyle: XLSX.CellStyle = {
      font: {
        name: "Arial",
        sz: 14,
        bold: true,
        color: { rgb: FF(d.accent) },
      },
      fill: { patternType: "solid", fgColor: { rgb: FF("F7F9FD") } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
    }
    const val = d.key === "itcRisk" || d.key === "itcSafe" ? d.value : d.value
    setCell(ws, kpiValueRow, 1 + col, val, vStyle)
  }

  for (let col = 0; col < 3; col++) {
    const d = kpiDefs[1][col]
    setCell(ws, kpiLabelRow2, 1 + col, d.label, {
      font: { name: "Arial", sz: 8, bold: true, color: { rgb: FF("FFFFFF") } },
      fill: { patternType: "solid", fgColor: { rgb: FF(d.accent) } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
    })
    setCell(ws, kpiValueRow2, 1 + col, d.value, {
      font: {
        name: "Arial",
        sz: 14,
        bold: true,
        color: { rgb: FF(d.accent) },
      },
      fill: { patternType: "solid", fgColor: { rgb: FF("F7F9FD") } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
    })
  }

  ws["!rows"][12] = { hpt: 8 }

  // Summary table header row 13 (B–E)
  const sh = ["Check / Status", "Count", "ITC at Risk (₹)", "Risk Level"]
  for (let c = 0; c < 4; c++) {
    setCell(ws, SUMMARY_TABLE_HEADER_R, 1 + c, sh[c], {
      font: { name: "Arial", sz: 10, bold: true, color: { rgb: FF("FFFFFF") } },
      fill: { patternType: "solid", fgColor: { rgb: FF("1E4080") } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: thinBorder(),
    })
  }

  let dataRow = SUMMARY_TABLE_HEADER_R + 1
  for (let i = 0; i < statusesWithData.length; i++) {
    const status = statusesWithData[i]
    const group = byStatus.get(status)!
    const count = group.length
    const itcSum = group.reduce((a, r) => a + r.totalITCAtRisk, 0)
    const wr = worstRisk(group)
    const alt = i % 2 === 0 ? "F0F4FB" : "FFFFFF"

    setCell(ws, dataRow, 1, status, {
      font: baseFont(9, false, "000000"),
      fill: { patternType: "solid", fgColor: { rgb: FF(alt) } },
      alignment: { horizontal: "left", vertical: "center", wrapText: true },
      border: thinBorder(),
    })

    const countCell: XLSX.CellObject = {
      t: "n",
      v: count,
      z: NF_INT,
      s: {
        font: baseFont(9, false, "000000"),
        fill: { patternType: "solid", fgColor: { rgb: FF(alt) } },
        alignment: { horizontal: "right", vertical: "center" },
        border: thinBorder(),
      },
    }
    ws[XLSX.utils.encode_cell({ r: dataRow, c: 2 })] = countCell

    ws[XLSX.utils.encode_cell({ r: dataRow, c: 3 })] = {
      t: "n",
      v: itcSum,
      z: NF_RUPEE,
      s: {
        font: baseFont(9, true, itcSum > 0 ? "C0392B" : "555555"),
        alignment: { horizontal: "right", vertical: "center" },
        border: thinBorder(),
        fill: { patternType: "solid", fgColor: { rgb: FF(alt) } },
      },
    }

    const riskAddr = XLSX.utils.encode_cell({ r: dataRow, c: 4 })
    ws[riskAddr] = {
      t: "s",
      v: wr,
      s: riskBadgeStyle(wr),
    }

    dataRow += 1
  }

  // Totals row
  const totalItc = rows.reduce((a, r) => a + r.totalITCAtRisk, 0)
  setCell(ws, dataRow, 1, "Total", {
    font: { name: "Arial", sz: 10, bold: true, color: { rgb: FF("FFFFFF") } },
    fill: { patternType: "solid", fgColor: { rgb: FF("1A3557") } },
    alignment: { horizontal: "left", vertical: "center" },
    border: thinBorder(),
  })

  ws[XLSX.utils.encode_cell({ r: dataRow, c: 2 })] = {
    t: "n",
    v: rows.length,
    z: NF_INT,
    s: {
      font: { name: "Arial", sz: 10, bold: true, color: { rgb: FF("FFFFFF") } },
      fill: { patternType: "solid", fgColor: { rgb: FF("1A3557") } },
      alignment: { horizontal: "right", vertical: "center" },
      border: thinBorder(),
    },
  }

  ws[XLSX.utils.encode_cell({ r: dataRow, c: 3 })] = {
    t: "n",
    v: totalItc,
    z: NF_RUPEE,
    s: {
      font: { name: "Arial", sz: 10, bold: true, color: { rgb: FF("FFFFFF") } },
      fill: { patternType: "solid", fgColor: { rgb: FF("1A3557") } },
      alignment: { horizontal: "right", vertical: "center" },
      border: thinBorder(),
    },
  }

  setCell(ws, dataRow, 4, "", {
    font: baseFont(10, true, "FFFFFF"),
    fill: { patternType: "solid", fgColor: { rgb: FF("1A3557") } },
    border: thinBorder(),
  })

  ws["!cols"] = SUMMARY_COL_WIDTHS
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: dataRow, c: 4 },
  })

  hideGridlines(ws)
  ws["!views"] = [
    {
      state: "frozen",
      xSplit: 0,
      ySplit: 1,
      topLeftCell: "A2",
      activeCell: "A2",
      pane: "bottomRight",
    },
  ]

  return ws
}

function buildDetailSheet(
  status: MismatchStatus,
  group: ReconciliationRow[],
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {}
  const n = DETAIL_HEADERS.length
  const lastRow = 4 + group.length - 1

  merge(ws, 0, 0, 0, n - 1)
  setCell(ws, 0, 0, status, {
    font: { name: "Arial", sz: 13, bold: true, color: { rgb: FF("FFFFFF") } },
    fill: { patternType: "solid", fgColor: { rgb: FF("1A3557") } },
    alignment: { horizontal: "center", vertical: "center" },
  })

  merge(ws, 1, 0, 1, n - 1)
  setCell(ws, 1, 0, STATUS_DESCRIPTIONS[status], {
    font: baseFont(9, false, "444444"),
    fill: { patternType: "solid", fgColor: { rgb: FF("EEF3FB") } },
    alignment: { horizontal: "left", vertical: "center", wrapText: true },
  })

  const countLine = `  ${group.length} invoice(s) in this category`
  merge(ws, 2, 0, 2, n - 1)
  setCell(ws, 2, 0, countLine, {
    font: { name: "Arial", sz: 9, bold: true, color: { rgb: FF("1E4080") } },
    fill: { patternType: "solid", fgColor: { rgb: FF("D6E4F7") } },
    alignment: { horizontal: "left", vertical: "center" },
  })

  const hdrStyle: XLSX.CellStyle = {
    font: { name: "Arial", sz: 9, bold: true, color: { rgb: FF("FFFFFF") } },
    fill: { patternType: "solid", fgColor: { rgb: FF("1E4080") } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: thinBorder(),
  }

  for (let c = 0; c < n; c++) {
    setCell(ws, 3, c, DETAIL_HEADERS[c], hdrStyle)
  }

  ws["!rows"] = []
  ws["!rows"][0] = { hpt: 32 }
  ws["!rows"][1] = { hpt: 28 }
  ws["!rows"][2] = { hpt: 16 }
  ws["!rows"][3] = { hpt: 20 }

  for (let i = 0; i < group.length; i++) {
    const r = group[i]
    const rr = 4 + i
    ws["!rows"][rr] = { hpt: 36 }
    const alt = i % 2 === 0 ? "F0F4FB" : "FFFFFF"
    const baseFill = { patternType: "solid" as const, fgColor: { rgb: FF(alt) } }

    const vals: (string | number)[] = [
      r.supplierGSTIN,
      r.supplierName,
      r.invoiceNumber,
      r.invoiceDate,
      r.taxable2B ?? "",
      r.igst2B ?? "",
      r.cgst2B ?? "",
      r.sgst2B ?? "",
      r.taxablePR ?? "",
      r.igstPR ?? "",
      r.cgstPR ?? "",
      r.sgstPR ?? "",
      r.itcAvailable ?? "",
      r.status,
      r.itcRisk,
      r.actionUrgency,
      r.recommendedAction,
      r.totalITCAtRisk,
    ]

    for (let c = 0; c < n; c++) {
      const base: XLSX.CellStyle = {
        font: baseFont(9, false, "000000"),
        fill: baseFill,
        alignment: {
          horizontal: DETAIL_NUM_COLS.has(c) ? "right" : "left",
          vertical: "center",
          wrapText: c === 16,
        },
        border: thinBorder(),
      }

      if (c <= 3 || c === 12) {
        ws[XLSX.utils.encode_cell({ r: rr, c })] = {
          t: "s",
          v: String(vals[c] ?? ""),
          s: {
            ...base,
            alignment: { horizontal: "left", vertical: "center", wrapText: false },
          },
        }
        continue
      }

      if (DETAIL_NUM_COLS.has(c) && c !== 17) {
        const num = vals[c]
        const numVal =
          typeof num === "number"
            ? num
            : num === "" || num === null || num === undefined
              ? null
              : Number(num)
        const cell: XLSX.CellObject =
          numVal !== null && !Number.isNaN(Number(numVal))
            ? {
                t: "n",
                v: Number(numVal),
                z: NF_INT,
                s: { ...base, font: baseFont(9, false, "000000") },
              }
            : {
                t: "s",
                v: "",
                s: base,
              }
        ws[XLSX.utils.encode_cell({ r: rr, c })] = cell
        continue
      }

      if (c === 13) {
        ws[XLSX.utils.encode_cell({ r: rr, c })] = {
          t: "s",
          v: String(vals[c]),
          s: {
            font: { name: "Arial", sz: 9, bold: true, color: { rgb: FF("1A3557") } },
            fill: { patternType: "solid", fgColor: { rgb: FF("E8F0FB") } },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: thinBorder(),
          },
        }
        continue
      }

      if (c === 14) {
        ws[XLSX.utils.encode_cell({ r: rr, c })] = {
          t: "s",
          v: r.itcRisk,
          s: riskBadgeStyle(r.itcRisk),
        }
        continue
      }

      if (c === 15) {
        ws[XLSX.utils.encode_cell({ r: rr, c })] = {
          t: "s",
          v: r.actionUrgency,
          s: urgencyBadgeStyle(r.actionUrgency),
        }
        continue
      }

      if (c === 16) {
        ws[XLSX.utils.encode_cell({ r: rr, c })] = {
          t: "s",
          v: r.recommendedAction,
          s: {
            font: { name: "Arial", sz: 8, color: { rgb: FF("333333") } },
            fill: baseFill,
            alignment: { horizontal: "left", vertical: "top", wrapText: true },
            border: thinBorder(),
          },
        }
        continue
      }

      if (c === 17) {
        ws[XLSX.utils.encode_cell({ r: rr, c })] = {
          t: "n",
          v: r.totalITCAtRisk,
          z: NF_RUPEE,
          s: {
            ...itcAtRiskStyle(r.totalITCAtRisk),
            fill: baseFill,
          },
        }
        continue
      }
    }
  }

  ws["!cols"] = DETAIL_COL_WIDTHS.map((wch) => ({ wch }))
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(3, lastRow), c: n - 1 },
  })

  hideGridlines(ws)
  ws["!views"] = [
    {
      state: "frozen",
      xSplit: 0,
      ySplit: 4,
      topLeftCell: "A5",
      activeCell: "A5",
      pane: "bottomRight",
    },
  ]

  return ws
}

export function exportReconciliationWorkbook(params: {
  month: number
  year: number
  requestId: string
  gstr2bFilename: string
  prFilename: string
  summary: ReconciliationSummary
  rows: ReconciliationRow[]
}): void {
  const { month, year, requestId, rows } = params

  const monthLabel = getMonthName(month).replace(/\s+/g, "")
  const safeRequestId = requestId.replace(/[/\\?%*:|"<>]/g, "-")
  const filename = `GSTRecon_${monthLabel}_${year}_${safeRequestId}.xlsx`

  const wb = XLSX.utils.book_new()
  wb.Props = { Title: "GSTRecon Reconciliation", Author: "GSTRecon" }

  const wsSummary = buildSummarySheet(params)
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary")

  const byStatus = groupRowsByStatus(rows)

  for (const status of EXPORT_STATUS_ORDER) {
    const group = byStatus.get(status)
    if (!group?.length) continue
    const ws = buildDetailSheet(status, group)
    XLSX.utils.book_append_sheet(wb, ws, status)
  }

  XLSX.writeFile(wb, filename, { cellStyles: true })
}
