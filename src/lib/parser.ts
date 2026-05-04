import * as XLSX from "xlsx"

import {
  validateGSTR2BFile,
  validatePurchaseRegister,
  type Gstr2bSheetHints,
} from "@/lib/file-validation"
import { findHeaderForAliases } from "@/lib/header-match"
import type { GSTR2BRow, ITCStatus, ParseResult, PurchaseRegisterRow } from "@/lib/types"
import { getMonthName, normaliseGSTIN, parseInvoiceDateFlexible } from "@/lib/utils"

const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ParseError"
  }
}

function findColumn(
  headers: string[],
  aliases: string[],
  label: string,
  examples: string,
  required: boolean,
): string | null {
  const found = findHeaderForAliases(headers, aliases)
  if (found) return found
  if (!required) return null
  throw new ParseError(
    `Missing required column: ${label}. Expected one of: ${examples}`,
  )
}

function rowToHeaderStrings(row: unknown[]): string[] {
  const out: string[] = []
  const max = Math.max(row.length, 0)
  for (let i = 0; i < max; i++) {
    out.push(String(row[i] ?? ""))
  }
  return out
}

function tryResolveColumns(
  headers: string[],
  required: { aliases: readonly string[]; label: string; examples: string }[],
): boolean {
  for (const req of required) {
    if (!findHeaderForAliases(headers, req.aliases)) return false
  }
  return true
}

function pickSheetName(sheetNames: string[], mode: "gstr2b" | "pr"): string {
  const lower = sheetNames.map((n) => n.toLowerCase())
  if (mode === "gstr2b") {
    const i = lower.findIndex((n) => n.includes("b2b"))
    if (i !== -1) return sheetNames[i]!
  }
  if (mode === "pr") {
    const i = lower.findIndex((n) => n.includes("purchase"))
    if (i !== -1) return sheetNames[i]!
  }
  return sheetNames[0]!
}

function readMatrixFromWorkbook(
  workbook: XLSX.WorkBook,
  mode: "gstr2b" | "pr",
): unknown[][] {
  const sheetName = pickSheetName(workbook.SheetNames, mode)
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new ParseError(
      "This file appears to be empty. Make sure you exported data rows from the portal.",
    )
  }
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][]
  return matrix
}

function detectHeaderRowIndex(
  matrix: unknown[][],
  mode: "gstr2b" | "pr",
): number {
  const required =
    mode === "gstr2b"
      ? [
          GSTR2B_ALIASES.supplierGSTIN,
          GSTR2B_ALIASES.invoiceNumber,
          GSTR2B_ALIASES.taxableValue,
        ]
      : [
          PR_ALIASES.supplierGSTIN,
          PR_ALIASES.invoiceNumber,
          PR_ALIASES.taxableValue,
        ]

  const maxScan = Math.min(matrix.length, 60)
  for (let r = 0; r < maxScan; r++) {
    const row = matrix[r] as unknown[]
    if (!Array.isArray(row) || row.every((c) => String(c ?? "").trim() === "")) {
      continue
    }
    const headers = rowToHeaderStrings(row)
    if (tryResolveColumns(headers, required)) {
      return r
    }
  }
  return -1
}

function matrixToObjects(matrix: unknown[][], headerRowIdx: number): Record<string, unknown>[] {
  const headerRow = matrix[headerRowIdx] as unknown[]
  const headers = rowToHeaderStrings(headerRow)
  const objects: Record<string, unknown>[] = []
  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    const row = matrix[r] as unknown[]
    if (!row || row.every((c) => String(c ?? "").trim() === "")) continue
    const obj: Record<string, unknown> = {}
    headers.forEach((h, idx) => {
      if (!h) return
      obj[h] = row[idx] ?? ""
    })
    objects.push(obj)
  }
  return objects
}

function readSheetRowsWithMeta(
  file: File,
  buffer: ArrayBuffer,
  mode: "gstr2b" | "pr",
): {
  rows: Record<string, unknown>[]
  sheetNames: string[]
  fileIsXlsx: boolean
} {
  const lower = file.name.toLowerCase()
  const workbook = XLSX.read(buffer, { type: "array" })
  if (!workbook.SheetNames?.length) {
    throw new ParseError(
      "This file appears to be empty. Make sure you exported data rows from the portal.",
    )
  }

  const sheetNames = [...workbook.SheetNames]

  if (lower.endsWith(".csv")) {
    const sheet = workbook.Sheets[workbook.SheetNames[0]!]!
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as unknown[][]
    if (!matrix.length) {
      throw new ParseError("File is empty — no data rows found")
    }
    const headerRowIdx = detectHeaderRowIndex(matrix, mode)
    if (headerRowIdx === -1) {
      throw new ParseError(
        "Could not find a header row with the required columns. Make sure the file includes a row with Supplier GSTIN and Invoice Number headers.",
      )
    }
    return {
      rows: matrixToObjects(matrix, headerRowIdx),
      sheetNames,
      fileIsXlsx: false,
    }
  }

  const matrix = readMatrixFromWorkbook(workbook, mode)
  if (!matrix.length) {
    throw new ParseError("File is empty — no data rows found")
  }
  const headerRowIdx = detectHeaderRowIndex(matrix, mode)
  if (headerRowIdx === -1) {
    throw new ParseError(
      "Could not find a header row with the required columns. For GSTR-2B, ensure a row contains GSTIN / CTIN and invoice columns (multi-line headers like “GSTIN of Supplier (ctin)” are supported).",
    )
  }
  return {
    rows: matrixToObjects(matrix, headerRowIdx),
    sheetNames,
    fileIsXlsx: true,
  }
}

export function parseNumber(val: unknown): number {
  if (val === null || val === undefined) return 0
  const s = String(val)
    .replace(/,/g, "")
    .replace(/₹/g, "")
    .replace(/\s+/g, "")
    .trim()
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

export function parseITCStatus(val: unknown): ITCStatus {
  const v = String(val ?? "")
    .trim()
    .toUpperCase()
  if (["Y", "YES", "1", "TRUE"].includes(v)) return "Y"
  if (["N", "NO", "0", "FALSE"].includes(v)) return "N"
  if (["T", "TEMP", "TEMPORARY"].includes(v)) return "T"
  return "Y"
}

export function parseReverseCharge(val: unknown): "Y" | "N" {
  const v = String(val ?? "")
    .trim()
    .toUpperCase()
  if (["Y", "YES", "1", "TRUE"].includes(v)) return "Y"
  return "N"
}

function joinMatrixRowForHeader(matrix: unknown[][], rowIdx: number): string {
  const row = matrix[rowIdx] as unknown[] | undefined
  if (!row) return ""
  return row
    .map((c) => String(c ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Parse GSTN return period text: "April 2024" or compact "042024" (MMYYYY). */
export function parseReturnPeriodToMonthYear(s: string | null | undefined): {
  month: number
  year: number
} | null {
  if (!s?.trim()) return null
  const t = s.trim()
  const compact = /^(\d{2})(\d{4})$/.exec(t.replace(/\s/g, ""))
  if (compact) {
    const month = Number(compact[1])
    const year = Number(compact[2])
    if (month >= 1 && month <= 12 && year >= 1990 && year <= 2100) {
      return { month, year }
    }
    return null
  }
  const named = /^([A-Za-z]+)\s+(\d{4})$/.exec(t)
  if (named) {
    const name = named[1]!.toLowerCase()
    const year = Number(named[2])
    const months = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ]
    let month = months.indexOf(name) + 1
    if (month === 0) {
      const prefix = name.slice(0, 3)
      const idx = months.findIndex((mn) => mn.startsWith(prefix))
      month = idx >= 0 ? idx + 1 : 0
    }
    if (month >= 1 && month <= 12 && year >= 1990 && year <= 2100) {
      return { month, year }
    }
  }
  return null
}

/** GSTR-2B official export: Excel row 2 often contains GSTIN, Legal Name, Return Period. */
export function extractRecipientDetailsFromRow2Text(row2TextRaw: string): {
  recipientGSTIN: string | null
  recipientName: string | null
  returnPeriod: string | null
} {
  const row2Text = row2TextRaw.replace(/\s+/g, " ").trim()
  if (!row2Text) {
    return { recipientGSTIN: null, recipientName: null, returnPeriod: null }
  }
  const gstinMatch = row2Text.match(
    /GSTIN\s*:\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})/i,
  )
  const nameMatch = row2Text.match(
    /Legal Name\s*:\s*([^|]+?)(?:\s{2,}|Return Period|$)/i,
  )
  const periodMatch = row2Text.match(
    /Return Period\s*:\s*([A-Za-z]+\s+\d{4}|\d{6})(?=\s|$|\||\s{2,})/i,
  )

  let recipientGSTIN: string | null = null
  if (gstinMatch?.[1]) {
    const ng = normaliseGSTIN(gstinMatch[1])
    recipientGSTIN = GSTIN_REGEX.test(ng) ? ng : null
  }
  const recipientName = nameMatch?.[1]
    ? nameMatch[1].trim().replace(/\s+/g, " ")
    : null
  const returnPeriod = periodMatch?.[1] ? periodMatch[1].trim() : null

  return { recipientGSTIN, recipientName, returnPeriod }
}

const GSTR2B_ALIASES = {
  supplierGSTIN: {
    aliases: [
      "ctin",
      "gstin",
      "supplier gstin",
      "supplier gst no",
      "gstin of supplier",
      "party gstin",
      "vendor gstin",
    ],
    label: "Supplier GSTIN",
    examples: "ctin, gstin, supplier gstin",
  },
  supplierName: {
    aliases: [
      "trdnm",
      "trade name",
      "supplier name",
      "legal name",
      "party name",
      "vendor name",
      "supplier trade name",
    ],
    label: "Supplier Name",
    examples: "trdnm, trade name, supplier name",
    required: false,
  },
  invoiceNumber: {
    aliases: [
      "inum",
      "invoice no",
      "invoice number",
      "invoice_no",
      "bill no",
      "bill number",
      "doc no",
      "document no",
      "voucher no",
    ],
    label: "Invoice Number",
    examples: "inum, invoice no, bill no",
  },
  invoiceDate: {
    aliases: [
      "dt",
      "invoice date",
      "bill date",
      "date",
      "doc date",
      "voucher date",
    ],
    label: "Invoice Date",
    examples: "dt, invoice date, bill date",
    required: false,
  },
  invoiceValue: {
    aliases: [
      "val",
      "invoice value",
      "total value",
      "gross value",
      "invoice amount",
    ],
    label: "Invoice Value",
    examples: "val, invoice value, total value",
    required: false,
  },
  placeOfSupply: {
    aliases: ["pos", "place of supply", "supply state"],
    label: "Place of Supply",
    examples: "pos, place of supply",
    required: false,
  },
  reverseCharge: {
    aliases: ["rev", "reverse charge", "rcm", "rch"],
    label: "Reverse Charge",
    examples: "rev, reverse charge",
    required: false,
  },
  itcAvailable: {
    aliases: [
      "itcavl",
      "itc avl",
      "itc available",
      "itc availability",
      "input tax credit",
    ],
    label: "ITC Available",
    examples: "itcavl, itc available",
    required: false,
  },
  itcUnavailableReason: {
    aliases: ["rsn", "reason", "itc unavailable reason"],
    label: "ITC Unavailable Reason",
    examples: "rsn",
    required: false,
  },
  taxableValue: {
    aliases: [
      "txval",
      "taxable value",
      "taxable amount",
      "taxable",
      "assessable value",
      "net amount",
    ],
    label: "Taxable Value",
    examples: "txval, taxable value, taxable",
  },
  igst: {
    aliases: [
      "igst",
      "igst amount",
      "integrated gst",
      "integrated tax",
      "igst paid",
    ],
    label: "IGST",
    examples: "igst, integrated tax",
    required: false,
  },
  cgst: {
    aliases: ["cgst", "cgst amount", "central gst", "central tax", "cgst paid"],
    label: "CGST",
    examples: "cgst, central tax",
    required: false,
  },
  sgst: {
    aliases: [
      "sgst",
      "sgst amount",
      "state gst",
      "state tax",
      "sgst paid",
      "utgst",
      "utgst amount",
    ],
    label: "SGST",
    examples: "sgst, state gst, utgst",
    required: false,
  },
  cess: {
    aliases: ["cess", "cess amount", "cess paid"],
    label: "Cess",
    examples: "cess",
    required: false,
  },
  taxRate: {
    aliases: ["rt", "rate", "tax rate", "gst rate", "rate of tax"],
    label: "Tax Rate",
    examples: "rt, tax rate",
    required: false,
  },
  invoiceType: {
    aliases: ["typ", "invoice type", "type"],
    label: "Invoice Type",
    examples: "typ, invoice type",
    required: false,
  },
  supplierFilingDate: {
    aliases: ["supfildt", "supplier filing date", "filing date"],
    label: "Supplier Filing Date",
    examples: "supfildt",
    required: false,
  },
  supprd: {
    aliases: [
      "supprd",
      "filing period",
      "filing period (supprd)",
      "supp filing period",
      "supplier filing period",
      "return period",
      "fil period",
      "supplier return period",
      "supplier period",
      "ret period",
      "tax period",
      "return period of supplier",
      "filing return period",
      "sup filing period",
      /* Do not add supfildt here — that maps supplier filing *date*, not period (MMYYYY). */
    ],
    label: "Supplier Return Period",
    examples: "supprd, 042024",
    required: false,
  },
} as const

const PR_ALIASES = {
  supplierGSTIN: {
    aliases: [
      "gstin",
      "supplier gstin",
      "gst no",
      "supplier gst no",
      "party gstin",
      "vendor gstin",
      "gstin of supplier",
    ],
    label: "Supplier GSTIN",
    examples: "GSTIN, ctin, Supplier GSTIN",
  },
  supplierName: {
    aliases: [
      "supplier name",
      "party name",
      "vendor name",
      "creditor name",
      "supplier",
      "party",
      "name",
    ],
    label: "Supplier Name",
    examples: "supplier name, party name",
    required: false,
  },
  invoiceNumber: {
    aliases: [
      "invoice no",
      "bill no",
      "invoice number",
      "bill number",
      "voucher no",
      "ref no",
      "doc no",
    ],
    label: "Invoice Number",
    examples: "invoice no, bill no, invoice number",
  },
  invoiceDate: {
    aliases: ["invoice date", "bill date", "date", "voucher date", "doc date"],
    label: "Invoice Date",
    examples: "invoice date, bill date",
    required: false,
  },
  taxableValue: {
    aliases: [
      "taxable value",
      "taxable amount",
      "taxable",
      "assessable value",
      "net amount",
      "basic amount",
    ],
    label: "Taxable Value",
    examples: "taxable value, taxable amount, taxable",
  },
  igst: {
    aliases: ["igst", "igst amount", "integrated tax", "integrated gst"],
    label: "IGST",
    examples: "igst, integrated tax",
    required: false,
  },
  cgst: {
    aliases: ["cgst", "cgst amount", "central tax", "central gst"],
    label: "CGST",
    examples: "cgst, central tax",
    required: false,
  },
  sgst: {
    aliases: [
      "sgst",
      "sgst amount",
      "state tax",
      "state gst",
      "utgst",
      "utgst amount",
    ],
    label: "SGST",
    examples: "sgst, state gst",
    required: false,
  },
  cess: {
    aliases: ["cess", "cess amount"],
    label: "Cess",
    examples: "cess",
    required: false,
  },
  totalInvoiceValue: {
    aliases: [
      "invoice value",
      "total amount",
      "invoice amount",
      "total",
      "gross amount",
      "net payable",
    ],
    label: "Total Invoice Value",
    examples: "invoice value, total amount",
    required: false,
  },
  placeOfSupply: {
    aliases: ["place of supply", "pos", "supply state"],
    label: "Place of Supply",
    examples: "place of supply, pos",
    required: false,
  },
  hsnCode: {
    aliases: ["hsn", "hsn code", "hsn/sac", "sac", "hsn sac", "commodity code"],
    label: "HSN Code",
    examples: "hsn, hsn code",
    required: false,
  },
  taxRate: {
    aliases: ["rate", "tax rate", "gst rate", "rate of tax", "gst %", "tax %"],
    label: "Tax Rate",
    examples: "rate, tax rate",
    required: false,
  },
  itcAmount: {
    aliases: ["booked itc", "itc amount", "itc claimed", "itc in books", "itc booked", "itc_amt", "itc amount (books)"],
    label: "Booked ITC",
    examples: "booked itc, itc amount",
    required: false,
  },
} as const

function getCell(row: Record<string, unknown>, headerName: string | null): unknown {
  if (!headerName) return ""
  if (headerName in row) return row[headerName]
  return ""
}

const GSTR2B_SUPPORTING_SHEETS = [
  "B2BA",
  "CDNR",
  "CDNRA",
  "ISD",
  "IMPG",
  "IMPGSEZ",
  "SUMMARY",
] as const

function analyzeGstr2bXlsxSheets(workbook: XLSX.WorkBook): {
  foundSheets: string[]
  b2bSheetName: string | null
  sheetHints: Gstr2bSheetHints
} {
  const foundSheets = [...workbook.SheetNames]
  const upper = foundSheets.map((s) => s.trim().toUpperCase())
  const hasB2BSheet = upper.some((s) => s === "B2B" || s.includes("B2B"))

  const supportingPresent = GSTR2B_SUPPORTING_SHEETS.filter((code) =>
    upper.some((u) => u === code),
  )
  const supportingCount = supportingPresent.length

  const sheetWarnings: string[] = []
  let sheetConfidence: "high" | "medium" | "low" = "low"
  if (!hasB2BSheet) {
    sheetConfidence = "low"
  } else if (supportingCount >= 2) {
    sheetConfidence = "high"
  } else if (supportingCount === 1) {
    sheetConfidence = "medium"
    sheetWarnings.push(
      "Only partial GSTR-2B sheet structure found. Official files usually contain B2BA, CDNR and other sheets alongside B2B.",
    )
  } else {
    sheetConfidence = "medium"
    sheetWarnings.push(
      "Only the B2B sheet was found. A complete GSTR-2B download from the GSTN portal typically includes B2BA, CDNR and other sheets. Please ensure you downloaded the full GSTR-2B file.",
    )
  }

  let b2bSheetName: string | null = null
  if (hasB2BSheet) {
    const exactIdx = upper.findIndex((u) => u === "B2B")
    if (exactIdx !== -1) {
      b2bSheetName = foundSheets[exactIdx]!
    } else {
      const fuzzyIdx = upper.findIndex((u) => u.includes("B2B"))
      if (fuzzyIdx !== -1) b2bSheetName = foundSheets[fuzzyIdx]!
    }
  }

  return {
    foundSheets,
    b2bSheetName,
    sheetHints: {
      hasB2BSheet,
      supportingCount,
      sheetWarnings,
      sheetConfidence,
    },
  }
}

function filterGstr2bRowsByTyp(
  rawRows: Record<string, unknown>[],
  typHeaderKey: string | null,
): { kept: Record<string, unknown>[]; skipped: number } {
  let skipped = 0
  const kept: Record<string, unknown>[] = []
  for (const row of rawRows) {
    let typ = ""
    if (typHeaderKey && typHeaderKey in row) {
      typ = String(row[typHeaderKey] ?? "")
        .trim()
        .toUpperCase()
    } else {
      typ = String(row.typ ?? row.Typ ?? row.TYPE ?? "")
        .trim()
        .toUpperCase()
    }
    if (typ === "DE" || typ === "SEWP" || typ === "SEWOP") {
      skipped++
      continue
    }
    if (typ === "R" || typ === "B2B" || typ === "") {
      kept.push(row)
      continue
    }
    skipped++
  }
  return { kept, skipped }
}

export async function parseGSTR2BFile(
  file: File,
): Promise<ParseResult<GSTR2BRow>> {
  const buffer = await file.arrayBuffer()
  const errors: string[] = []
  let recipientGSTIN: string | null = null
  let recipientName: string | null = null
  let returnPeriod: string | null = null
  const recipientFields = () => {
    const detected = parseReturnPeriodToMonthYear(returnPeriod)
    return {
      recipientGSTIN,
      recipientName,
      returnPeriod,
      detectedMonth: detected?.month ?? null,
      detectedYear: detected?.year ?? null,
    }
  }
  const lower = file.name.toLowerCase()
  const workbook = XLSX.read(buffer, { type: "array" })
  if (!workbook.SheetNames?.length) {
    throw new ParseError(
      "This file appears to be empty. Make sure you exported data rows from the portal.",
    )
  }

  let rawAll: Record<string, unknown>[] = []
  let fileIsXlsx: boolean
  let foundSheets: string[] = [...workbook.SheetNames]
  let sheetHints: Gstr2bSheetHints

  if (lower.endsWith(".csv")) {
    fileIsXlsx = false
    const sheet = workbook.Sheets[workbook.SheetNames[0]!]!
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as unknown[][]
    if (!matrix.length) {
      throw new ParseError("File is empty — no data rows found")
    }
    if (matrix.length >= 2) {
      const ex = extractRecipientDetailsFromRow2Text(joinMatrixRowForHeader(matrix, 1))
      recipientGSTIN = ex.recipientGSTIN
      recipientName = ex.recipientName
      returnPeriod = ex.returnPeriod
    }
    const headerRowIdx = detectHeaderRowIndex(matrix, "gstr2b")
    if (headerRowIdx === -1) {
      throw new ParseError(
        "Could not find a header row with the required columns. Make sure the file includes a row with Supplier GSTIN and Invoice Number headers.",
      )
    }
    rawAll = matrixToObjects(matrix, headerRowIdx)
    sheetHints = {
      hasB2BSheet: true,
      supportingCount: 0,
      sheetWarnings: [],
      sheetConfidence: "high",
    }
  } else {
    fileIsXlsx = true
    const analysis = analyzeGstr2bXlsxSheets(workbook)
    foundSheets = analysis.foundSheets
    sheetHints = analysis.sheetHints
    if (!analysis.b2bSheetName) {
      const validation = validateGSTR2BFile(
        [],
        [],
        true,
        foundSheets,
        sheetHints,
        {
          totalRowsParsed: 0,
          skippedRowCount: 0,
          b2bRowCountAfterTypFilter: 0,
        },
        [],
      )
      return {
        rows: [],
        filename: file.name,
        rowCount: 0,
        totalParsed: 0,
        skipped: 0,
        errors: [],
        validation,
        ...recipientFields(),
      }
    }
    const b2bSheet = workbook.Sheets[analysis.b2bSheetName]
    if (!b2bSheet) {
      throw new ParseError(
        "This file appears to be empty. Make sure you exported data rows from the portal.",
      )
    }
    const matrix = XLSX.utils.sheet_to_json(b2bSheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as unknown[][]
    if (!matrix.length) {
      throw new ParseError("File is empty — no data rows found")
    }
    if (matrix.length >= 2) {
      const ex = extractRecipientDetailsFromRow2Text(joinMatrixRowForHeader(matrix, 1))
      recipientGSTIN = ex.recipientGSTIN
      recipientName = ex.recipientName
      returnPeriod = ex.returnPeriod
    }
    const headerRowIdx = detectHeaderRowIndex(matrix, "gstr2b")
    if (headerRowIdx === -1) {
      throw new ParseError(
        "Could not find a header row with the required columns. For GSTR-2B, ensure a row contains GSTIN / CTIN and invoice columns (multi-line headers like “GSTIN of Supplier (ctin)” are supported).",
      )
    }
    rawAll = matrixToObjects(matrix, headerRowIdx)
  }

  if (!rawAll.length) {
    throw new ParseError("File is empty — no data rows found")
  }

  const headersAll = Object.keys(rawAll[0] ?? {}).filter((h) => h.trim() !== "")
  if (!headersAll.length) {
    throw new ParseError("File is empty — no data rows found")
  }

  const typHeaderKey = findHeaderForAliases(headersAll, [
    ...GSTR2B_ALIASES.invoiceType.aliases,
    "document type",
  ])
  const totalParsed = rawAll.length
  const { kept: rawRows, skipped: typSkipped } = filterGstr2bRowsByTyp(
    rawAll,
    typHeaderKey,
  )
  const infoMessages: string[] = []
  if (typSkipped > 0) {
    infoMessages.push(
      `${typSkipped} non-B2B rows (SEZ/Deemed Export) were excluded. Only regular B2B invoices are processed in V1.`,
    )
  }

  const headers = Object.keys(rawRows[0] ?? {}).filter((h) => h.trim() !== "")
  if (!headers.length && totalParsed > 0) {
    const validation = validateGSTR2BFile(
      [],
      headersAll,
      fileIsXlsx,
      foundSheets,
      sheetHints,
      {
        totalRowsParsed: totalParsed,
        skippedRowCount: typSkipped,
        b2bRowCountAfterTypFilter: 0,
      },
      infoMessages,
    )
    return {
      rows: [],
      filename: file.name,
      rowCount: 0,
      totalParsed,
      skipped: typSkipped,
      errors: [],
      validation,
      ...recipientFields(),
    }
  }
  if (!headers.length) {
    throw new ParseError("File is empty — no data rows found")
  }

  const col = {
    supplierGSTIN: findColumn(
      headers,
      [...GSTR2B_ALIASES.supplierGSTIN.aliases],
      GSTR2B_ALIASES.supplierGSTIN.label,
      GSTR2B_ALIASES.supplierGSTIN.examples,
      true,
    ),
    supplierName: findColumn(
      headers,
      [...GSTR2B_ALIASES.supplierName.aliases],
      GSTR2B_ALIASES.supplierName.label,
      GSTR2B_ALIASES.supplierName.examples,
      false,
    ),
    invoiceNumber: findColumn(
      headers,
      [...GSTR2B_ALIASES.invoiceNumber.aliases],
      GSTR2B_ALIASES.invoiceNumber.label,
      GSTR2B_ALIASES.invoiceNumber.examples,
      true,
    ),
    invoiceDate: findColumn(
      headers,
      [...GSTR2B_ALIASES.invoiceDate.aliases],
      GSTR2B_ALIASES.invoiceDate.label,
      GSTR2B_ALIASES.invoiceDate.examples,
      false,
    ),
    invoiceDtOnly: findColumn(headers, ["dt"], "Invoice date (dt)", "dt", false),
    invoiceValue: findColumn(
      headers,
      [...GSTR2B_ALIASES.invoiceValue.aliases],
      GSTR2B_ALIASES.invoiceValue.label,
      GSTR2B_ALIASES.invoiceValue.examples,
      false,
    ),
    placeOfSupply: findColumn(
      headers,
      [...GSTR2B_ALIASES.placeOfSupply.aliases],
      GSTR2B_ALIASES.placeOfSupply.label,
      GSTR2B_ALIASES.placeOfSupply.examples,
      false,
    ),
    reverseCharge: findColumn(
      headers,
      [...GSTR2B_ALIASES.reverseCharge.aliases],
      GSTR2B_ALIASES.reverseCharge.label,
      GSTR2B_ALIASES.reverseCharge.examples,
      false,
    ),
    itcAvailable: findColumn(
      headers,
      [...GSTR2B_ALIASES.itcAvailable.aliases],
      GSTR2B_ALIASES.itcAvailable.label,
      GSTR2B_ALIASES.itcAvailable.examples,
      false,
    ),
    itcUnavailableReason: findColumn(
      headers,
      [...GSTR2B_ALIASES.itcUnavailableReason.aliases],
      GSTR2B_ALIASES.itcUnavailableReason.label,
      GSTR2B_ALIASES.itcUnavailableReason.examples,
      false,
    ),
    taxableValue: findColumn(
      headers,
      [...GSTR2B_ALIASES.taxableValue.aliases],
      GSTR2B_ALIASES.taxableValue.label,
      GSTR2B_ALIASES.taxableValue.examples,
      true,
    ),
    igst: findColumn(
      headers,
      [...GSTR2B_ALIASES.igst.aliases],
      GSTR2B_ALIASES.igst.label,
      GSTR2B_ALIASES.igst.examples,
      false,
    ),
    cgst: findColumn(
      headers,
      [...GSTR2B_ALIASES.cgst.aliases],
      GSTR2B_ALIASES.cgst.label,
      GSTR2B_ALIASES.cgst.examples,
      false,
    ),
    sgst: findColumn(
      headers,
      [...GSTR2B_ALIASES.sgst.aliases],
      GSTR2B_ALIASES.sgst.label,
      GSTR2B_ALIASES.sgst.examples,
      false,
    ),
    cess: findColumn(
      headers,
      [...GSTR2B_ALIASES.cess.aliases],
      GSTR2B_ALIASES.cess.label,
      GSTR2B_ALIASES.cess.examples,
      false,
    ),
    taxRate: findColumn(
      headers,
      [...GSTR2B_ALIASES.taxRate.aliases],
      GSTR2B_ALIASES.taxRate.label,
      GSTR2B_ALIASES.taxRate.examples,
      false,
    ),
    invoiceType: findColumn(
      headers,
      [...GSTR2B_ALIASES.invoiceType.aliases],
      GSTR2B_ALIASES.invoiceType.label,
      GSTR2B_ALIASES.invoiceType.examples,
      false,
    ),
    supplierFilingDate: findColumn(
      headers,
      [...GSTR2B_ALIASES.supplierFilingDate.aliases],
      GSTR2B_ALIASES.supplierFilingDate.label,
      GSTR2B_ALIASES.supplierFilingDate.examples,
      false,
    ),
    supprd: findColumn(
      headers,
      [...GSTR2B_ALIASES.supprd.aliases],
      GSTR2B_ALIASES.supprd.label,
      GSTR2B_ALIASES.supprd.examples,
      false,
    ),
  }

  const rows: GSTR2BRow[] = []
  for (const r of rawRows) {
    const supplierGSTIN = String(getCell(r, col.supplierGSTIN) ?? "").trim()
    const rawInvoiceNumber = String(getCell(r, col.invoiceNumber) ?? "").trim()
    const invoiceNumber = rawInvoiceNumber
    if (!supplierGSTIN || supplierGSTIN === "-") continue
    if (!invoiceNumber || invoiceNumber === "-") continue

    const gstinNorm = normaliseGSTIN(supplierGSTIN)
    if (!GSTIN_REGEX.test(gstinNorm)) {
      errors.push(
        `GSTIN "${supplierGSTIN}" does not match the standard 15-character GSTIN format — please verify with the supplier.`,
      )
    }

    const taxableValue = parseNumber(getCell(r, col.taxableValue))
    if (taxableValue === 0) {
      errors.push(
        `Warning: Invoice ${invoiceNumber} has taxable value ₹0 — please verify this is intentional.`,
      )
    }

    const invFromDt = col.invoiceDtOnly ? String(getCell(r, col.invoiceDtOnly) ?? "").trim() : ""
    const invFromInvCol = col.invoiceDate ? String(getCell(r, col.invoiceDate) ?? "").trim() : ""
    const invoiceDateMerged = invFromDt || invFromInvCol

    rows.push({
      supplierGSTIN,
      supplierName: String(getCell(r, col.supplierName) ?? "").trim(),
      supplierFilingDate: String(getCell(r, col.supplierFilingDate) ?? "").trim(),
      ...(() => {
        const filingPeriodRaw = col.supprd ? String(getCell(r, col.supprd) ?? "").trim() : ""
        const filingPeriod = filingPeriodRaw || undefined
        return {
          supprd: filingPeriod,
          supplierFilingPeriod: filingPeriod,
        }
      })(),
      invoiceNumber,
      rawInvoiceNumber,
      invoiceType: String(getCell(r, col.invoiceType) ?? "").trim() || "B2B",
      invoiceDate: invoiceDateMerged,
      ...(invFromDt ? { dt: invFromDt } : {}),
      invoiceValue: parseNumber(getCell(r, col.invoiceValue)),
      placeOfSupply: String(getCell(r, col.placeOfSupply) ?? "").trim(),
      reverseCharge: parseReverseCharge(getCell(r, col.reverseCharge)),
      itcAvailable: col.itcAvailable
        ? parseITCStatus(getCell(r, col.itcAvailable))
        : "Y",
      itcUnavailableReason: col.itcUnavailableReason
        ? String(getCell(r, col.itcUnavailableReason) ?? "").trim()
        : undefined,
      taxableValue,
      igst: parseNumber(getCell(r, col.igst)),
      cgst: parseNumber(getCell(r, col.cgst)),
      sgst: parseNumber(getCell(r, col.sgst)),
      cess: parseNumber(getCell(r, col.cess)),
      taxRate: parseNumber(getCell(r, col.taxRate)),
    })
  }

  if (!rows.length) {
    const validation = validateGSTR2BFile(
      rawRows,
      headers,
      fileIsXlsx,
      foundSheets,
      sheetHints,
      {
        totalRowsParsed: totalParsed,
        skippedRowCount: typSkipped,
        b2bRowCountAfterTypFilter: rawRows.length,
      },
      infoMessages,
    )
    return {
      rows: [],
      filename: file.name,
      rowCount: 0,
      totalParsed,
      skipped: typSkipped,
      errors,
      validation,
      ...recipientFields(),
    }
  }

  const validation = validateGSTR2BFile(
    rawRows,
    headers,
    fileIsXlsx,
    foundSheets,
    sheetHints,
    {
      totalRowsParsed: totalParsed,
      skippedRowCount: typSkipped,
      b2bRowCountAfterTypFilter: rawRows.length,
    },
    infoMessages,
  )

  return {
    rows,
    filename: file.name,
    rowCount: rows.length,
    totalParsed,
    skipped: typSkipped,
    errors,
    validation,
    ...recipientFields(),
  }
}

export async function parsePurchaseRegisterFile(
  file: File,
): Promise<ParseResult<PurchaseRegisterRow>> {
  const buffer = await file.arrayBuffer()
  const errors: string[] = []
  const { rows: rawRows } = readSheetRowsWithMeta(file, buffer, "pr")
  if (!rawRows.length) {
    throw new ParseError("File is empty — no data rows found")
  }
  const headers = Object.keys(rawRows[0] ?? {}).filter((h) => h.trim() !== "")
  if (!headers.length) {
    throw new ParseError("File is empty — no data rows found")
  }

  const col = {
    supplierGSTIN: findColumn(
      headers,
      [...PR_ALIASES.supplierGSTIN.aliases],
      PR_ALIASES.supplierGSTIN.label,
      PR_ALIASES.supplierGSTIN.examples,
      true,
    ),
    supplierName: findColumn(
      headers,
      [...PR_ALIASES.supplierName.aliases],
      PR_ALIASES.supplierName.label,
      PR_ALIASES.supplierName.examples,
      false,
    ),
    invoiceNumber: findColumn(
      headers,
      [...PR_ALIASES.invoiceNumber.aliases],
      PR_ALIASES.invoiceNumber.label,
      PR_ALIASES.invoiceNumber.examples,
      true,
    ),
    invoiceDate: findColumn(
      headers,
      [...PR_ALIASES.invoiceDate.aliases],
      PR_ALIASES.invoiceDate.label,
      PR_ALIASES.invoiceDate.examples,
      false,
    ),
    taxableValue: findColumn(
      headers,
      [...PR_ALIASES.taxableValue.aliases],
      PR_ALIASES.taxableValue.label,
      PR_ALIASES.taxableValue.examples,
      true,
    ),
    igst: findColumn(
      headers,
      [...PR_ALIASES.igst.aliases],
      PR_ALIASES.igst.label,
      PR_ALIASES.igst.examples,
      false,
    ),
    cgst: findColumn(
      headers,
      [...PR_ALIASES.cgst.aliases],
      PR_ALIASES.cgst.label,
      PR_ALIASES.cgst.examples,
      false,
    ),
    sgst: findColumn(
      headers,
      [...PR_ALIASES.sgst.aliases],
      PR_ALIASES.sgst.label,
      PR_ALIASES.sgst.examples,
      false,
    ),
    cess: findColumn(
      headers,
      [...PR_ALIASES.cess.aliases],
      PR_ALIASES.cess.label,
      PR_ALIASES.cess.examples,
      false,
    ),
    totalInvoiceValue: findColumn(
      headers,
      [...PR_ALIASES.totalInvoiceValue.aliases],
      PR_ALIASES.totalInvoiceValue.label,
      PR_ALIASES.totalInvoiceValue.examples,
      false,
    ),
    placeOfSupply: findColumn(
      headers,
      [...PR_ALIASES.placeOfSupply.aliases],
      PR_ALIASES.placeOfSupply.label,
      PR_ALIASES.placeOfSupply.examples,
      false,
    ),
    hsnCode: findColumn(
      headers,
      [...PR_ALIASES.hsnCode.aliases],
      PR_ALIASES.hsnCode.label,
      PR_ALIASES.hsnCode.examples,
      false,
    ),
    taxRate: findColumn(
      headers,
      [...PR_ALIASES.taxRate.aliases],
      PR_ALIASES.taxRate.label,
      PR_ALIASES.taxRate.examples,
      false,
    ),
    itcAmount: findColumn(
      headers,
      [...PR_ALIASES.itcAmount.aliases],
      PR_ALIASES.itcAmount.label,
      PR_ALIASES.itcAmount.examples,
      false,
    ),
  }

  const rows: PurchaseRegisterRow[] = []
  for (const r of rawRows) {
    const supplierGSTIN = String(getCell(r, col.supplierGSTIN) ?? "").trim()
    const rawInvoiceNumber = String(getCell(r, col.invoiceNumber) ?? "").trim()
    const invoiceNumber = rawInvoiceNumber
    if (!supplierGSTIN || supplierGSTIN === "-") continue
    if (!invoiceNumber || invoiceNumber === "-") continue

    const gstinNorm = normaliseGSTIN(supplierGSTIN)
    if (!GSTIN_REGEX.test(gstinNorm)) {
      errors.push(
        `GSTIN "${supplierGSTIN}" does not match the standard 15-character GSTIN format — please verify with the supplier.`,
      )
    }

    const taxableValue = parseNumber(getCell(r, col.taxableValue))
    if (taxableValue === 0) {
      errors.push(
        `Warning: Invoice ${invoiceNumber} has taxable value ₹0 — please verify this is intentional.`,
      )
    }

    const igst = parseNumber(getCell(r, col.igst))
    const cgst = parseNumber(getCell(r, col.cgst))
    const sgst = parseNumber(getCell(r, col.sgst))
    const cess = parseNumber(getCell(r, col.cess))
    const totalFromCol = parseNumber(getCell(r, col.totalInvoiceValue))
    const totalInvoiceValue =
      totalFromCol > 0 ? totalFromCol : taxableValue + igst + cgst + sgst + cess

    const taxRateCell = col.taxRate ? parseNumber(getCell(r, col.taxRate)) : NaN
    const taxRate = Number.isFinite(taxRateCell) && taxRateCell > 0 ? taxRateCell : undefined

    const rawBookedItc = col.itcAmount ? parseNumber(getCell(r, col.itcAmount)) : NaN
    const bookedItc =
      col.itcAmount && Number.isFinite(rawBookedItc) ? rawBookedItc : undefined

    rows.push({
      supplierGSTIN,
      supplierName: String(getCell(r, col.supplierName) ?? "").trim(),
      invoiceNumber,
      rawInvoiceNumber,
      invoiceDate: String(getCell(r, col.invoiceDate) ?? "").trim(),
      taxableValue,
      igst,
      cgst,
      sgst,
      cess,
      totalInvoiceValue,
      placeOfSupply: String(getCell(r, col.placeOfSupply) ?? "").trim() || undefined,
      hsnCode: String(getCell(r, col.hsnCode) ?? "").trim() || undefined,
      ...(taxRate !== undefined ? { taxRate } : {}),
      ...(bookedItc !== undefined ? { itcAmount: bookedItc } : {}),
    })
  }

  if (!rows.length) {
    throw new ParseError(
      "Zero valid rows after parsing — check if file has data rows below the header",
    )
  }

  const validation = validatePurchaseRegister(rawRows, headers)

  return { rows, filename: file.name, rowCount: rows.length, errors, validation }
}

export type PeriodMismatchResult = {
  hasMismatch: boolean
  crossPeriodCount: number
  earliestDate: string | null
  message: string | null
}

/** Flags PR rows whose invoice date is outside the selected GSTR-2B month/year. */
export function detectPeriodMismatch(
  prRows: PurchaseRegisterRow[],
  selectedMonth: number,
  selectedYear: number,
): PeriodMismatchResult {
  const monthName = getMonthName(selectedMonth)
  let crossPeriodCount = 0
  let earliest: Date | null = null

  for (const row of prRows) {
    const d = parseInvoiceDateFlexible(row.invoiceDate)
    if (!d) continue
    const m = d.getMonth() + 1
    const y = d.getFullYear()
    if (m !== selectedMonth || y !== selectedYear) {
      crossPeriodCount++
      if (!earliest || d < earliest) earliest = d
    }
  }

  if (crossPeriodCount === 0) {
    return {
      hasMismatch: false,
      crossPeriodCount: 0,
      earliestDate: null,
      message: null,
    }
  }

  const earliestStr = earliest
    ? earliest.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null

  const message = `Your Purchase Register contains ${crossPeriodCount} invoice(s) from outside ${monthName} ${selectedYear}.\nEarliest: ${earliestStr ?? "—"}.\nThese will show as "In PR Only" and may inflate your mismatch count.`

  return {
    hasMismatch: true,
    crossPeriodCount,
    earliestDate: earliestStr,
    message,
  }
}
