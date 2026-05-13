import * as XLSX from "xlsx-js-style"

import {
  validateGSTR2BFile,
  validatePurchaseRegister,
  type Gstr2bSheetHints,
} from "@/lib/file-validation"
import { findHeaderForAliases } from "@/lib/header-match"
import {
  PR_CESS_ALIASES,
  PR_CGST_ALIASES,
  PR_IGST_ALIASES,
  PR_INVOICE_DATE_ALIASES,
  PR_INVOICE_NUMBER_ALIASES,
  PR_ITC_AVAILABLE_ALIASES,
  PR_PLACE_OF_SUPPLY_ALIASES,
  PR_REVERSE_CHARGE_ALIASES,
  PR_SGST_ALIASES,
  PR_SUPPLIER_GSTIN_ALIASES,
  PR_SUPPLIER_NAME_ALIASES,
  PR_TAXABLE_VALUE_ALIASES,
  PR_TOTAL_INVOICE_VALUE_ALIASES,
} from "@/lib/pr-column-aliases"
import type {
  DocumentType,
  GSTR2BRow,
  ITCStatus,
  ParseResult,
  PurchaseRegisterRow,
} from "@/lib/types"
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

function detectPurchaseRegisterHeaderRowIndex(matrix: unknown[][]): number {
  const gstinAliases = [...PR_SUPPLIER_GSTIN_ALIASES]
  const invAliases = [...PR_INVOICE_NUMBER_ALIASES]
  const txAliases = [...PR_TAXABLE_VALUE_ALIASES]
  const maxScan = Math.min(matrix.length, 21)
  let bestR = -1
  let bestScore = -1

  for (let r = 0; r < maxScan; r++) {
    const row = matrix[r] as unknown[]
    if (!Array.isArray(row) || row.every((c) => String(c ?? "").trim() === "")) {
      continue
    }
    const headers = rowToHeaderStrings(row)
    const hasG = Boolean(findHeaderForAliases(headers, gstinAliases))
    const hasI = Boolean(findHeaderForAliases(headers, invAliases))
    const hasT = Boolean(findHeaderForAliases(headers, txAliases))
    const score = (hasG ? 1 : 0) + (hasI ? 1 : 0) + (hasT ? 1 : 0)
    const qualifies =
      score >= 3 || (hasG && hasI) || (hasG && hasT)
    if (!qualifies) continue

    if (
      bestR === -1 ||
      score > bestScore ||
      (score === bestScore && r < bestR)
    ) {
      bestScore = score
      bestR = r
    }
  }

  return bestR
}

function detectHeaderRowIndex(
  matrix: unknown[][],
  mode: "gstr2b" | "pr",
): number {
  if (mode === "pr") {
    // Two-row merged PR headers are resolved in readSheetRowsWithMeta via
    // detectPurchaseRegisterStrictHeaderMatrix + matrixToObjectsFromHeaders.
    return detectPurchaseRegisterHeaderRowIndex(matrix)
  }

  const required = [
    GSTR2B_ALIASES.supplierGSTIN,
    GSTR2B_ALIASES.invoiceNumber,
    GSTR2B_ALIASES.taxableValue,
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
    if (r + 1 < matrix.length) {
      const row2 = matrix[r + 1] as unknown[]
      if (!Array.isArray(row2) || row2.every((c) => String(c ?? "").trim() === "")) {
        continue
      }
      const merged = combineTwoHeaderRows(row, row2)
      if (tryResolveColumns(merged, required)) {
        return r
      }
    }
  }
  return -1
}

/**
 * GST portal 2-row header: prefer top cell when non-empty (gap-fill from bottom).
 * When both rows have text in the same column and top is a merged group title
 * ("Invoice Details", "Tax Amount"), use the sub-header row text so aliases match.
 */
function combineTwoHeaderRows(top: unknown[], bottom: unknown[]): string[] {
  const len = Math.max(top.length, bottom.length)
  const out: string[] = []
  const isGroupBanner = (s: string) => {
    const u = s.toLowerCase().trim()
    return (
      u === "invoice details" ||
      u === "tax amount" ||
      u === "credit note/debit note details" ||
      u === "debit note details" ||
      u === "original details" ||
      u === "revised details" ||
      /^tax amount\b/i.test(s.trim())
    )
  }
  for (let i = 0; i < len; i++) {
    const t = String(top[i] ?? "").trim()
    const b = String(bottom[i] ?? "").trim()
    if (!t) {
      out.push(b)
      continue
    }
    if (!b) {
      out.push(t)
      continue
    }
    if (isGroupBanner(t)) out.push(b)
    else out.push(t)
  }
  return out
}

type Gstr2bHeaderDetection = {
  dataStartRow: number
  headers: string[]
}

/**
 * Rows 0–20: find a single header row, or a group row + sub-header row (GST portal export).
 */
function detectGstr2bHeaderMatrix(matrix: unknown[][]): Gstr2bHeaderDetection | null {
  const required = [
    GSTR2B_ALIASES.supplierGSTIN,
    GSTR2B_ALIASES.invoiceNumber,
    GSTR2B_ALIASES.taxableValue,
  ]

  const maxScan = Math.min(matrix.length, 21)
  for (let r = 0; r < maxScan; r++) {
    const row = matrix[r] as unknown[]
    if (!Array.isArray(row) || row.every((c) => String(c ?? "").trim() === "")) {
      continue
    }
    const headersSingle = rowToHeaderStrings(row)
    if (tryResolveColumns(headersSingle, required)) {
      return { dataStartRow: r + 1, headers: headersSingle }
    }
    if (r + 1 < matrix.length) {
      const row2 = matrix[r + 1] as unknown[]
      if (!Array.isArray(row2) || row2.every((c) => String(c ?? "").trim() === "")) {
        continue
      }
      const combined = combineTwoHeaderRows(row, row2)
      if (tryResolveColumns(combined, required)) {
        return { dataStartRow: r + 2, headers: combined }
      }
    }
  }
  return null
}

/** Single-row or two-row merged header (GST portal / third-party GSTR-style PR exports). */
function detectPurchaseRegisterStrictHeaderMatrix(
  matrix: unknown[][],
): Gstr2bHeaderDetection | null {
  const required = [
    {
      aliases: [...PR_SUPPLIER_GSTIN_ALIASES],
      label: "Supplier GSTIN",
      examples: "GSTIN, gstin of supplier",
    },
    {
      aliases: [...PR_INVOICE_NUMBER_ALIASES],
      label: "Invoice Number",
      examples: "invoice number, invoice no",
    },
    {
      aliases: [...PR_TAXABLE_VALUE_ALIASES],
      label: "Taxable Value",
      examples: "taxable value, taxable amount",
    },
  ]

  const maxScan = Math.min(matrix.length, 21)
  for (let r = 0; r < maxScan; r++) {
    const row = matrix[r] as unknown[]
    if (!Array.isArray(row) || row.every((c) => String(c ?? "").trim() === "")) {
      continue
    }
    const headersSingle = rowToHeaderStrings(row)
    if (tryResolveColumns(headersSingle, required)) {
      return { dataStartRow: r + 1, headers: headersSingle }
    }
    if (r + 1 < matrix.length) {
      const row2 = matrix[r + 1] as unknown[]
      if (!Array.isArray(row2) || row2.every((c) => String(c ?? "").trim() === "")) {
        continue
      }
      const combined = combineTwoHeaderRows(row, row2)
      if (tryResolveColumns(combined, required)) {
        return { dataStartRow: r + 2, headers: combined }
      }
    }
  }
  return null
}

function matrixToObjectsFromHeaders(
  matrix: unknown[][],
  dataStartRow: number,
  headers: string[],
): Record<string, unknown>[] {
  const objects: Record<string, unknown>[] = []
  for (let r = dataStartRow; r < matrix.length; r++) {
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

/** Prefer B2B sheet, then other sheets that may contain the same columns (e.g. ITC Available). */
function orderedGstr2bSheetCandidates(
  sheetNames: string[],
  preferredB2bName: string | null,
): string[] {
  const all = sheetNames.filter((n) => n != null && String(n).trim() !== "")
  const upper = all.map((n) => n.trim().toUpperCase())
  const seen = new Set<string>()
  const out: string[] = []
  const push = (name: string) => {
    if (!seen.has(name)) {
      seen.add(name)
      out.push(name)
    }
  }
  if (preferredB2bName) push(preferredB2bName)
  const exactB2b = all.find((_, i) => upper[i] === "B2B")
  if (exactB2b) push(exactB2b)
  for (let i = 0; i < all.length; i++) {
    if (upper[i].includes("B2B")) push(all[i]!)
  }
  for (const name of all) push(name)
  return out
}

function findGstr2bMatrixAndHeaders(
  workbook: XLSX.WorkBook,
  preferredB2bName: string | null,
): { matrix: unknown[][]; sheetUsed: string; detection: Gstr2bHeaderDetection } | null {
  for (const sheetName of orderedGstr2bSheetCandidates(workbook.SheetNames, preferredB2bName)) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: false,
    }) as unknown[][]
    if (!matrix.length) continue
    const detection = detectGstr2bHeaderMatrix(matrix)
    if (detection) return { matrix, sheetUsed: sheetName, detection }
  }
  return null
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

function rowsFromMatrixPurchaseRegister(matrix: unknown[][]): Record<string, unknown>[] {
  const strict = detectPurchaseRegisterStrictHeaderMatrix(matrix)
  if (strict) {
    return matrixToObjectsFromHeaders(matrix, strict.dataStartRow, strict.headers)
  }
  const headerRowIdx = detectPurchaseRegisterHeaderRowIndex(matrix)
  if (headerRowIdx === -1) {
    throw new ParseError(
      "Could not find a header row with the required columns. Make sure the file includes a row with Supplier GSTIN and Invoice Number headers.",
    )
  }
  return matrixToObjects(matrix, headerRowIdx)
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
    const rows =
      mode === "pr"
        ? rowsFromMatrixPurchaseRegister(matrix)
        : (() => {
            const headerRowIdx = detectHeaderRowIndex(matrix, mode)
            if (headerRowIdx === -1) {
              throw new ParseError(
                "Could not find a header row with the required columns. Make sure the file includes a row with Supplier GSTIN and Invoice Number headers.",
              )
            }
            return matrixToObjects(matrix, headerRowIdx)
          })()
    return {
      rows,
      sheetNames,
      fileIsXlsx: false,
    }
  }

  const matrix = readMatrixFromWorkbook(workbook, mode)
  if (!matrix.length) {
    throw new ParseError("File is empty — no data rows found")
  }
  const rows =
    mode === "pr"
      ? rowsFromMatrixPurchaseRegister(matrix)
      : (() => {
          const headerRowIdx = detectHeaderRowIndex(matrix, mode)
          if (headerRowIdx === -1) {
            throw new ParseError(
              "Could not find a header row with the required columns. For GSTR-2B, ensure a row contains GSTIN / CTIN and invoice columns (multi-line headers like “GSTIN of Supplier (ctin)” are supported).",
            )
          }
          return matrixToObjects(matrix, headerRowIdx)
        })()
  return {
    rows,
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

/** Rows in the raw matrix from dataStartRow onward that contain any non-empty cell. */
function countNonEmptyDataRowsInMatrix(matrix: unknown[][], dataStartRow: number): number {
  let n = 0
  for (let r = dataStartRow; r < matrix.length; r++) {
    const row = matrix[r] as unknown[]
    if (!row) continue
    if (row.some((c) => String(c ?? "").trim() !== "")) n++
  }
  return n
}

/** When PR has no standard IGST/CGST/SGST/Cess column, sum ledger-style Tally columns by header text. */
function sumPrLedgerTaxColumns(
  row: Record<string, unknown>,
  headers: string[],
  kind: "igst" | "cgst" | "sgst" | "cess",
): number {
  let sum = 0
  for (const h of headers) {
    const hl = h.toLowerCase()
    if (kind === "igst") {
      if (!hl.includes("igst")) continue
      if (hl.includes("cgst") || hl.includes("sgst")) continue
    } else if (kind === "cgst") {
      if (!hl.includes("cgst")) continue
    } else if (kind === "sgst") {
      if (!hl.includes("sgst")) continue
    } else if (!/\bcess\b/i.test(h) && !hl.includes("compensation cess")) {
      continue
    }
    sum += parseNumber(row[h])
  }
  return sum
}

/**
 * Count data rows that have at least one value in mapped identity columns (GSTIN, invoice no., date).
 * Excludes rows like "Grand Total" that only have tax/amount columns filled.
 */
function countPurchaseRegisterIdentityRows(
  rawRows: Record<string, unknown>[],
  identityHeaderKeys: string[],
): number {
  if (identityHeaderKeys.length === 0) return 0
  return rawRows.filter((row) =>
    identityHeaderKeys.some((h) => {
      const v = row[h]
      if (v === "" || v == null) return false
      return String(v).trim() !== ""
    }),
  ).length
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
      "trade/legal name",
      "trade legal name",
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
    aliases: [
      "rev",
      "reverse charge",
      "supply attract reverse charge",
      "rcm",
      "rch",
    ],
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
      "itc availibility",
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
      "taxable value (₹)",
      "taxable value rs",
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
      "integrated tax(₹)",
      "integrated tax rs",
      "igst rs",
      "igst paid",
    ],
    label: "IGST",
    examples: "igst, integrated tax",
    required: false,
  },
  cgst: {
    aliases: [
      "cgst",
      "cgst amount",
      "central gst",
      "central tax",
      "central tax(₹)",
      "central tax rs",
      "cgst rs",
      "cgst paid",
    ],
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
      "state ut tax",
      "state ut tax rs",
      "state/ut tax",
      "state/ut tax(₹)",
      "sgst rs",
      "sgst paid",
      "utgst",
      "utgst amount",
    ],
    label: "SGST",
    examples: "sgst, state gst, utgst",
    required: false,
  },
  cess: {
    aliases: ["cess", "cess amount", "cess(₹)", "cess rs", "cess paid"],
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
    aliases: [
      "supfildt",
      "supplier filing date",
      "filing date",
      "gstr-1/1a/iff/gstr-5 filing date",
      "gstr-1/5 filling date",
      "gstr-1/5 filing date",
    ],
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
      "gstr-1/1a/iff/gstr-5 period",
      "gstr-1/5 filling period",
      "gstr-1/5 filing period",
      "gstr 1 1a iff gstr 5 period",
      "gstr 1 5 filling period",
      /* Do not add supfildt here — that maps supplier filing *date*, not period (MMYYYY). */
    ],
    label: "Supplier Return Period",
    examples: "supprd, 042024",
    required: false,
  },
} as const

/** Note columns on B2B-CDNR / debit-note sheets (portal naming). */
const CDNR_ALIASES = {
  noteNumber: {
    aliases: [
      "note number",
      "note no",
      "note no.",
      "credit note no",
      "debit note no",
      "inum",
      "invoice no",
      "invoice number",
      "document no",
      "voucher no",
      "doc no",
    ],
  },
  noteDate: {
    aliases: [
      "note date",
      "note dt",
      "dt",
      "date",
      "invoice date",
      "document date",
      "voucher date",
    ],
  },
  noteType: {
    aliases: [
      "note type",
      "type",
      "typ",
      "document type",
      "note supply type",
      "supply type",
    ],
  },
  noteValue: {
    aliases: [
      "note value",
      "note supply value",
      "total note value",
      "val",
      "invoice value",
      "total value",
    ],
  },
} as const

const CDNR_EXTRA_ALIASES = {
  noteNumber: {
    aliases: [
      "note number",
      "note no",
      "note no.",
      "credit note no",
      "debit note no",
      "inum",
      "invoice no",
      "document no",
      "voucher no",
      "doc no",
    ],
    label: "Note Number",
    examples: "note number, note no, inum",
  },
  noteDate: {
    aliases: [
      "note date",
      "note dt",
      "dt",
      "date",
      "invoice date",
      "document date",
      "voucher date",
    ],
    label: "Note Date",
    examples: "note date, dt, invoice date",
  },
  noteType: {
    aliases: [
      "note type",
      "type",
      "typ",
      "document type",
      "note supply type",
      "supply type",
    ],
    label: "Note Type",
    examples: "note type, type",
  },
  noteValue: {
    aliases: [
      "note value",
      "note supply value",
      "total note value",
      "val",
      "invoice value",
      "total value",
    ],
    label: "Note Value",
    examples: "note value, val",
  },
} as const

const PR_ALIASES = {
  supplierGSTIN: {
    aliases: [...PR_SUPPLIER_GSTIN_ALIASES],
    label: "Supplier GSTIN",
    examples: "GSTIN, ctin, Supplier GSTIN",
  },
  supplierName: {
    aliases: [...PR_SUPPLIER_NAME_ALIASES],
    label: "Supplier Name",
    examples: "supplier name, party name",
    required: false,
  },
  invoiceNumber: {
    aliases: [...PR_INVOICE_NUMBER_ALIASES],
    label: "Invoice Number",
    examples: "invoice no, bill no, invoice number",
  },
  invoiceDate: {
    aliases: [...PR_INVOICE_DATE_ALIASES],
    label: "Invoice Date",
    examples: "invoice date, bill date",
    required: false,
  },
  taxableValue: {
    aliases: [...PR_TAXABLE_VALUE_ALIASES],
    label: "Taxable Value",
    examples: "taxable value, taxable amount, taxable",
  },
  igst: {
    aliases: [...PR_IGST_ALIASES],
    label: "IGST",
    examples: "igst, integrated tax",
    required: false,
  },
  cgst: {
    aliases: [...PR_CGST_ALIASES],
    label: "CGST",
    examples: "cgst, central tax",
    required: false,
  },
  sgst: {
    aliases: [...PR_SGST_ALIASES],
    label: "SGST",
    examples: "sgst, state gst",
    required: false,
  },
  cess: {
    aliases: [...PR_CESS_ALIASES],
    label: "Cess",
    examples: "cess",
    required: false,
  },
  itcAvailable: {
    aliases: [...PR_ITC_AVAILABLE_ALIASES],
    label: "ITC Available",
    examples: "itc availability, itcavl",
    required: false,
  },
  reverseCharge: {
    aliases: [...PR_REVERSE_CHARGE_ALIASES],
    label: "Reverse Charge",
    examples: "reverse charge, supply attract reverse charge",
    required: false,
  },
  totalInvoiceValue: {
    aliases: [...PR_TOTAL_INVOICE_VALUE_ALIASES],
    label: "Total Invoice Value",
    examples: "invoice value, total amount",
    required: false,
  },
  placeOfSupply: {
    aliases: [...PR_PLACE_OF_SUPPLY_ALIASES],
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
  "B2B-CDNR",
  "B2B-CDNRA",
  "B2B-DNRA",
  "Debit notes (Original)",
  "ISD",
  "IMPG",
  "IMPGSEZ",
  "SUMMARY",
] as const

/** True if a workbook tab matches a portal supporting-sheet hint (incl. B2BCDNR / B2B-CDNR). */
function sheetNameMatchesSupportingCode(sheetName: string, code: string): boolean {
  const u = sheetName.trim().toUpperCase()
  const c = code.trim().toUpperCase()
  if (u === c) return true
  if (code === "B2B-CDNR" && u === "B2BCDNR") return true
  if (code === "B2B-CDNRA" && u === "B2BCDNRA") return true
  if (code === "B2B-DNRA" && u === "B2BDNRA") return true
  return false
}

function classifyNoteRowDocType(noteTypeCell: unknown): DocumentType {
  const v = String(noteTypeCell ?? "")
    .trim()
    .toUpperCase()
  if (v === "D" || v === "DN" || v === "DEBIT" || v.startsWith("DEBIT")) return "CDNR-DN"
  return "CDNR"
}

type Gstr2bSheetParseKind = "B2B" | "B2BA" | "CDNR_SHEET" | "CDNR_DN_SHEET"

function parseGstr2bSheetMatrix(
  matrix: unknown[][],
  sheetKind: Gstr2bSheetParseKind,
  errors: string[],
): {
  rows: GSTR2BRow[]
  rawParsed: number
  typSkipped: number
  rawRowsForValidation?: Record<string, unknown>[]
  validationHeaders?: string[]
} {
  const det = detectGstr2bHeaderMatrix(matrix)
  if (!det) {
    return { rows: [], rawParsed: 0, typSkipped: 0 }
  }
  let rawAll = matrixToObjectsFromHeaders(matrix, det.dataStartRow, det.headers)
  const rawParsed = rawAll.length
  let typSkipped = 0
  let rawRows = rawAll
  if (sheetKind === "B2B") {
    const headersAll = Object.keys(rawAll[0] ?? {}).filter((h) => h.trim() !== "")
    const typHeaderKey = findHeaderForAliases(headersAll, [
      ...GSTR2B_ALIASES.invoiceType.aliases,
      "document type",
    ])
    const { kept, skipped } = filterGstr2bRowsByTyp(rawAll, typHeaderKey)
    rawRows = kept
    typSkipped = skipped
  }

  if (!rawRows.length) {
    return { rows: [], rawParsed, typSkipped }
  }

  const headers = Object.keys(rawRows[0] ?? {}).filter((h) => h.trim() !== "")
  if (!headers.length) {
    return { rows: [], rawParsed, typSkipped }
  }

  const rawRowsForValidation = sheetKind === "B2B" ? rawRows : undefined
  const validationHeaders = sheetKind === "B2B" ? headers : undefined

  const isCdnr = sheetKind === "CDNR_SHEET" || sheetKind === "CDNR_DN_SHEET"

  const colInvoiceNumber = isCdnr
    ? findColumn(
        headers,
        [...CDNR_EXTRA_ALIASES.noteNumber.aliases, ...GSTR2B_ALIASES.invoiceNumber.aliases],
        CDNR_EXTRA_ALIASES.noteNumber.label,
        CDNR_EXTRA_ALIASES.noteNumber.examples,
        true,
      )
    : findColumn(
        headers,
        [...GSTR2B_ALIASES.invoiceNumber.aliases],
        GSTR2B_ALIASES.invoiceNumber.label,
        GSTR2B_ALIASES.invoiceNumber.examples,
        true,
      )

  const colInvoiceDate = isCdnr
    ? findColumn(
        headers,
        [...CDNR_EXTRA_ALIASES.noteDate.aliases, ...GSTR2B_ALIASES.invoiceDate.aliases],
        CDNR_EXTRA_ALIASES.noteDate.label,
        CDNR_EXTRA_ALIASES.noteDate.examples,
        false,
      )
    : findColumn(
        headers,
        [...GSTR2B_ALIASES.invoiceDate.aliases],
        GSTR2B_ALIASES.invoiceDate.label,
        GSTR2B_ALIASES.invoiceDate.examples,
        false,
      )

  const colInvoiceValue = isCdnr
    ? findColumn(
        headers,
        [...CDNR_EXTRA_ALIASES.noteValue.aliases, ...GSTR2B_ALIASES.invoiceValue.aliases],
        CDNR_EXTRA_ALIASES.noteValue.label,
        CDNR_EXTRA_ALIASES.noteValue.examples,
        false,
      )
    : findColumn(
        headers,
        [...GSTR2B_ALIASES.invoiceValue.aliases],
        GSTR2B_ALIASES.invoiceValue.label,
        GSTR2B_ALIASES.invoiceValue.examples,
        false,
      )

  const colNoteType = isCdnr
    ? findColumn(
        headers,
        [...CDNR_EXTRA_ALIASES.noteType.aliases],
        CDNR_EXTRA_ALIASES.noteType.label,
        CDNR_EXTRA_ALIASES.noteType.examples,
        false,
      )
    : null

  const colOinum =
    sheetKind === "B2BA"
      ? findColumn(
          headers,
          [
            "oinum",
            "original invoice no",
            "original invoice number",
            "original doc no",
            "amended invoice no",
          ],
          "Original invoice number (oinum)",
          "oinum",
          false,
        )
      : null

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
    invoiceNumber: colInvoiceNumber,
    invoiceDate: colInvoiceDate,
    invoiceDtOnly: findColumn(headers, ["dt"], "Invoice date (dt)", "dt", false),
    invoiceValue: colInvoiceValue,
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
    const inumVal = String(getCell(r, col.invoiceNumber) ?? "").trim()
    const invoiceNumber = inumVal
    if (!supplierGSTIN || supplierGSTIN === "-") continue
    if (!invoiceNumber || invoiceNumber === "-") continue

    const gstinNorm = normaliseGSTIN(supplierGSTIN)
    if (!GSTIN_REGEX.test(gstinNorm)) {
      errors.push(
        `GSTIN "${supplierGSTIN}" does not match the standard 15-character GSTIN format — please verify with the supplier.`,
      )
    }

    let taxableValue = parseNumber(getCell(r, col.taxableValue))
    let igst = parseNumber(getCell(r, col.igst))
    let cgst = parseNumber(getCell(r, col.cgst))
    let sgst = parseNumber(getCell(r, col.sgst))
    let cess = parseNumber(getCell(r, col.cess))
    let invoiceValue = parseNumber(getCell(r, col.invoiceValue))

    let documentType: DocumentType = sheetKind === "B2BA" ? "B2BA" : "B2B"
    let invoiceTypeStr = String(getCell(r, col.invoiceType) ?? "").trim() || "B2B"

    if (sheetKind === "CDNR_DN_SHEET") {
      documentType = "CDNR-DN"
      invoiceTypeStr = "CDNR-DN"
    } else if (sheetKind === "CDNR_SHEET") {
      documentType = colNoteType ? classifyNoteRowDocType(getCell(r, colNoteType)) : "CDNR"
      invoiceTypeStr = documentType === "CDNR-DN" ? "CDNR-DN" : "CDNR"
      if (documentType === "CDNR") {
        const taxesNonNegative = igst >= 0 && cgst >= 0 && sgst >= 0 && cess >= 0
        if (taxableValue > 0 && taxesNonNegative) {
          taxableValue = -taxableValue
          igst = -igst
          cgst = -cgst
          sgst = -sgst
          cess = -cess
          if (invoiceValue > 0) invoiceValue = -invoiceValue
        }
      }
    }

    if (taxableValue === 0) {
      errors.push(
        `Warning: Invoice ${invoiceNumber} has taxable value ₹0 — please verify this is intentional.`,
      )
    }

    const invFromDt = col.invoiceDtOnly ? String(getCell(r, col.invoiceDtOnly) ?? "").trim() : ""
    const invFromInvCol = col.invoiceDate ? String(getCell(r, col.invoiceDate) ?? "").trim() : ""
    const invoiceDateMerged = invFromDt || invFromInvCol

    const filingPeriodRaw = col.supprd ? String(getCell(r, col.supprd) ?? "").trim() : ""
    const filingPeriod = filingPeriodRaw || undefined

    const oinumRaw =
      sheetKind === "B2BA" && colOinum ? String(getCell(r, colOinum) ?? "").trim() : ""
    const rawInvDisplay =
      sheetKind === "B2BA" && oinumRaw ? oinumRaw : invoiceNumber

    rows.push({
      supplierGSTIN,
      supplierName: String(getCell(r, col.supplierName) ?? "").trim(),
      supplierFilingDate: String(getCell(r, col.supplierFilingDate) ?? "").trim(),
      supprd: filingPeriod,
      supplierFilingPeriod: filingPeriod,
      invoiceNumber,
      rawInvoiceNumber: rawInvDisplay,
      invoiceType: invoiceTypeStr,
      documentType,
      invoiceDate: invoiceDateMerged,
      ...(invFromDt ? { dt: invFromDt } : {}),
      invoiceValue,
      placeOfSupply: String(getCell(r, col.placeOfSupply) ?? "").trim(),
      reverseCharge: parseReverseCharge(getCell(r, col.reverseCharge)),
      itcAvailable: col.itcAvailable
        ? parseITCStatus(getCell(r, col.itcAvailable))
        : "Y",
      itcUnavailableReason: col.itcUnavailableReason
        ? String(getCell(r, col.itcUnavailableReason) ?? "").trim()
        : undefined,
      taxableValue,
      igst,
      cgst,
      sgst,
      cess,
      taxRate: parseNumber(getCell(r, col.taxRate)),
    })
  }

  return { rows, rawParsed, typSkipped, rawRowsForValidation, validationHeaders }
}

function analyzeGstr2bXlsxSheets(workbook: XLSX.WorkBook): {
  foundSheets: string[]
  b2bSheetName: string | null
  sheetHints: Gstr2bSheetHints
} {
  const foundSheets = [...workbook.SheetNames]
  const upper = foundSheets.map((s) => s.trim().toUpperCase())
  /** Tabs that contain "B2B" in the name but are not the main B2B invoice sheet. */
  const isNonMainB2bNamedTab = (u: string) =>
    u === "B2B-CDNR" ||
    u === "B2BCDNR" ||
    u === "B2B-CDNRA" ||
    u === "B2BCDNRA" ||
    u === "B2B-DNRA" ||
    u === "B2BDNRA" ||
    u === "B2BA" ||
    u.startsWith("B2BA ")
  const hasB2BSheet = upper.some(
    (s) => !isNonMainB2bNamedTab(s) && (s === "B2B" || s.startsWith("B2B ") || s.includes("B2B")),
  )

  const supportingPresent = GSTR2B_SUPPORTING_SHEETS.filter((code) =>
    foundSheets.some(
      (sheetName) =>
        sheetName.trim().toUpperCase() === code.trim().toUpperCase() ||
        sheetNameMatchesSupportingCode(sheetName, code),
    ),
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
      "Only partial GSTR-2B sheet structure found. Official files usually contain B2BA, B2B-CDNR, and other sheets alongside B2B.",
    )
  } else {
    sheetConfidence = "medium"
    sheetWarnings.push(
      "Only the B2B sheet was found. A complete GSTR-2B download from the GSTN portal typically includes B2BA, B2B-CDNR, and other sheets. Please ensure you downloaded the full GSTR-2B file.",
    )
  }

  let b2bSheetName: string | null = null
  if (hasB2BSheet) {
    const exactIdx = upper.findIndex((u) => u === "B2B")
    if (exactIdx !== -1) {
      b2bSheetName = foundSheets[exactIdx]!
    } else {
      const fuzzyIdx = upper.findIndex(
        (u) => !isNonMainB2bNamedTab(u) && u.includes("B2B"),
      )
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
    // GSTN exports vary: some files use "R"/"B2B", others spell "Regular".
    if (typ === "R" || typ === "B2B" || typ === "" || typ === "REGULAR" || typ === "REG") {
      kept.push(row)
      continue
    }
    skipped++
  }
  return { kept, skipped }
}

/**
 * Parse a single GSTR-2B workbook tab (B2BA, B2B-CDNR, debit notes) using the same
 * header detection as B2B. B2B-only path stays in parseGstr2bSheetMatrix.
 */
function parseSheetAsB2BRows(
  matrix: unknown[][],
  docType: "B2BA" | "CDNR" | "CDNR-DN",
  errors: string[],
): { rows: GSTR2BRow[]; rawParsed: number } {
  const detection = detectGstr2bHeaderMatrix(matrix)
  if (!detection) return { rows: [], rawParsed: 0 }

  const rawRows = matrixToObjectsFromHeaders(matrix, detection.dataStartRow, detection.headers)
  const rawParsed = rawRows.length
  if (!rawRows.length) return { rows: [], rawParsed }

  const headers = Object.keys(rawRows[0] ?? {}).filter((h) => h.trim() !== "")
  if (!headers.length) return { rows: [], rawParsed }

  const isNote = docType === "CDNR" || docType === "CDNR-DN"

  const invoiceNumberCol = findColumn(
    headers,
    isNote
      ? [...CDNR_ALIASES.noteNumber.aliases, ...GSTR2B_ALIASES.invoiceNumber.aliases]
      : [...GSTR2B_ALIASES.invoiceNumber.aliases],
    "Invoice/Note Number",
    "note number, invoice no",
    false,
  )

  const invoiceDateCol = findColumn(
    headers,
    isNote
      ? [...CDNR_ALIASES.noteDate.aliases, ...GSTR2B_ALIASES.invoiceDate.aliases]
      : [...GSTR2B_ALIASES.invoiceDate.aliases],
    "Invoice/Note Date",
    "note date, invoice date",
    false,
  )

  const invoiceValueCol = findColumn(
    headers,
    isNote
      ? [...CDNR_ALIASES.noteValue.aliases, ...GSTR2B_ALIASES.invoiceValue.aliases]
      : [...GSTR2B_ALIASES.invoiceValue.aliases],
    "Invoice/Note Value",
    "note value, invoice value",
    false,
  )

  const noteTypeCol =
    docType === "CDNR"
      ? findColumn(headers, [...CDNR_ALIASES.noteType.aliases], "Note Type", "note type, type", false)
      : null

  const colOinum =
    docType === "B2BA"
      ? findColumn(
          headers,
          [
            "oinum",
            "original invoice no",
            "original invoice number",
            "original doc no",
            "amended invoice no",
          ],
          "Original invoice number (oinum)",
          "oinum",
          false,
        )
      : null

  const invoiceDtOnlyCol = findColumn(headers, ["dt"], "Invoice date (dt)", "dt", false)

  const supplierGSTINCol = findColumn(
    headers,
    [...GSTR2B_ALIASES.supplierGSTIN.aliases],
    "Supplier GSTIN",
    "gstin of supplier",
    false,
  )
  const supplierNameCol = findColumn(
    headers,
    [...GSTR2B_ALIASES.supplierName.aliases],
    "Supplier Name",
    "trade name",
    false,
  )
  const supplierFilingDateCol = findColumn(
    headers,
    [...GSTR2B_ALIASES.supplierFilingDate.aliases],
    "Filing Date",
    "supfildt",
    false,
  )
  const supprdCol = findColumn(headers, [...GSTR2B_ALIASES.supprd.aliases], "Filing Period", "supprd", false)
  const placeOfSupplyCol = findColumn(headers, [...GSTR2B_ALIASES.placeOfSupply.aliases], "POS", "pos", false)
  const reverseChargeCol = findColumn(headers, [...GSTR2B_ALIASES.reverseCharge.aliases], "RC", "rev", false)
  const itcAvailableCol = findColumn(headers, [...GSTR2B_ALIASES.itcAvailable.aliases], "ITC", "itcavl", false)
  const itcUnavailableReasonCol = findColumn(
    headers,
    [...GSTR2B_ALIASES.itcUnavailableReason.aliases],
    "Reason",
    "rsn",
    false,
  )
  const taxableValueCol = findColumn(
    headers,
    [...GSTR2B_ALIASES.taxableValue.aliases],
    "Taxable Value",
    "txval",
    false,
  )
  const igstCol = findColumn(headers, [...GSTR2B_ALIASES.igst.aliases], "IGST", "igst", false)
  const cgstCol = findColumn(headers, [...GSTR2B_ALIASES.cgst.aliases], "CGST", "cgst", false)
  const sgstCol = findColumn(headers, [...GSTR2B_ALIASES.sgst.aliases], "SGST", "sgst", false)
  const cessCol = findColumn(headers, [...GSTR2B_ALIASES.cess.aliases], "Cess", "cess", false)
  const taxRateCol = findColumn(headers, [...GSTR2B_ALIASES.taxRate.aliases], "Tax Rate", "rt", false)

  const rows: GSTR2BRow[] = []

  for (const r of rawRows) {
    const supplierGSTIN = String(getCell(r, supplierGSTINCol) ?? "").trim()
    if (!supplierGSTIN || supplierGSTIN === "-") continue

    const revisedInvoiceNumber = String(getCell(r, invoiceNumberCol) ?? "").trim()
    if (!revisedInvoiceNumber || revisedInvoiceNumber === "-") continue

    const gstinNorm = normaliseGSTIN(supplierGSTIN)
    if (!GSTIN_REGEX.test(gstinNorm)) {
      errors.push(
        `GSTIN "${supplierGSTIN}" does not match GSTIN format — verify with supplier.`,
      )
    }

    let resolvedDocType: DocumentType = docType
    if (docType === "CDNR" && noteTypeCol) {
      resolvedDocType = classifyNoteRowDocType(getCell(r, noteTypeCol))
    }

    const rawTaxableValue = parseNumber(getCell(r, taxableValueCol))
    const rawIgst = parseNumber(getCell(r, igstCol))
    const rawCgst = parseNumber(getCell(r, cgstCol))
    const rawSgst = parseNumber(getCell(r, sgstCol))
    const rawCess = parseNumber(getCell(r, cessCol))
    let invoiceValue = parseNumber(getCell(r, invoiceValueCol))

    let taxableValue = rawTaxableValue
    let igst = rawIgst
    let cgst = rawCgst
    let sgst = rawSgst
    let cess = rawCess

    if (resolvedDocType === "CDNR") {
      const taxesNonNegative = igst >= 0 && cgst >= 0 && sgst >= 0 && cess >= 0
      if (taxableValue > 0 && taxesNonNegative) {
        taxableValue = -taxableValue
        igst = -igst
        cgst = -cgst
        sgst = -sgst
        cess = -cess
        if (invoiceValue > 0) invoiceValue = -invoiceValue
      }
    }

    if (taxableValue === 0) {
      errors.push(
        `Warning: Invoice ${revisedInvoiceNumber} has taxable value ₹0 — please verify this is intentional.`,
      )
    }

    const filingPeriodRaw = supprdCol ? String(getCell(r, supprdCol) ?? "").trim() : ""
    const filingPeriod = filingPeriodRaw || undefined

    const invFromDt = invoiceDtOnlyCol ? String(getCell(r, invoiceDtOnlyCol) ?? "").trim() : ""
    const invFromInvCol = invoiceDateCol ? String(getCell(r, invoiceDateCol) ?? "").trim() : ""
    const invoiceDateMerged = invFromDt || invFromInvCol

    const oinumRaw = docType === "B2BA" && colOinum ? String(getCell(r, colOinum) ?? "").trim() : ""
    const rawInvDisplay = docType === "B2BA" && oinumRaw ? oinumRaw : revisedInvoiceNumber

    rows.push({
      supplierGSTIN,
      supplierName: String(getCell(r, supplierNameCol) ?? "").trim(),
      supplierFilingDate: String(getCell(r, supplierFilingDateCol) ?? "").trim(),
      supprd: filingPeriod,
      supplierFilingPeriod: filingPeriod,
      invoiceNumber: revisedInvoiceNumber,
      rawInvoiceNumber: rawInvDisplay,
      invoiceType: resolvedDocType,
      documentType: resolvedDocType,
      invoiceDate: invoiceDateMerged,
      ...(invFromDt ? { dt: invFromDt } : {}),
      invoiceValue,
      placeOfSupply: String(getCell(r, placeOfSupplyCol) ?? "").trim(),
      reverseCharge: parseReverseCharge(getCell(r, reverseChargeCol)),
      itcAvailable: itcAvailableCol ? parseITCStatus(getCell(r, itcAvailableCol)) : "Y",
      itcUnavailableReason: itcUnavailableReasonCol
        ? String(getCell(r, itcUnavailableReasonCol) ?? "").trim()
        : undefined,
      taxableValue,
      igst,
      cgst,
      sgst,
      cess,
      taxRate: parseNumber(getCell(r, taxRateCol)),
    })
  }

  return { rows, rawParsed }
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

  let fileIsXlsx: boolean
  let foundSheets: string[] = [...workbook.SheetNames]
  let sheetHints: Gstr2bSheetHints
  let gstr2bMatrix: unknown[][] | null = null
  let gstr2bDataStartRow = 0
  let rows: GSTR2BRow[] = []
  let totalParsed = 0
  let typSkipped = 0
  let b2bRawRows: Record<string, unknown>[] = []
  let b2bHeaders: string[] = []
  const infoMessages: string[] = []

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
    gstr2bMatrix = matrix
    if (matrix.length >= 2) {
      const ex = extractRecipientDetailsFromRow2Text(joinMatrixRowForHeader(matrix, 1))
      recipientGSTIN = ex.recipientGSTIN
      recipientName = ex.recipientName
      returnPeriod = ex.returnPeriod
    }
    const det = detectGstr2bHeaderMatrix(matrix)
    if (!det) {
      throw new ParseError(
        "Could not find a header row with the required columns. Make sure the file includes a row with Supplier GSTIN and Invoice Number headers.",
      )
    }
    gstr2bDataStartRow = det.dataStartRow
    const parsed = parseGstr2bSheetMatrix(matrix, "B2B", errors)
    rows = parsed.rows
    totalParsed = parsed.rawParsed
    typSkipped = parsed.typSkipped
    b2bRawRows = parsed.rawRowsForValidation ?? []
    b2bHeaders = parsed.validationHeaders ?? []
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

    const located = findGstr2bMatrixAndHeaders(workbook, analysis.b2bSheetName)
    if (!located) {
      throw new ParseError(
        "Could not find the GSTR-2B B2B header row / data in this workbook. Make sure you uploaded the official GSTR-2B file downloaded from GSTN (with a 'B2B' sheet) and that it contains regular invoice rows.",
      )
    }

    gstr2bMatrix = located.matrix
    gstr2bDataStartRow = located.detection.dataStartRow
    if (!sheetHints.hasB2BSheet) {
      sheetHints = {
        ...sheetHints,
        hasB2BSheet: true,
      }
    }

    if (located.matrix.length >= 2) {
      const ex = extractRecipientDetailsFromRow2Text(joinMatrixRowForHeader(located.matrix, 1))
      recipientGSTIN = ex.recipientGSTIN
      recipientName = ex.recipientName
      returnPeriod = ex.returnPeriod
    }

    const parsedB2b = parseGstr2bSheetMatrix(located.matrix, "B2B", errors)
    rows = parsedB2b.rows
    totalParsed = parsedB2b.rawParsed
    typSkipped = parsedB2b.typSkipped
    b2bRawRows = parsedB2b.rawRowsForValidation ?? []
    b2bHeaders = parsedB2b.validationHeaders ?? []

    let b2baRows: GSTR2BRow[] = []
    let cdnrRows: GSTR2BRow[] = []
    let cdnrDNRows: GSTR2BRow[] = []

    for (const sheetName of workbook.SheetNames) {
      const u = sheetName.trim().toUpperCase()
      const lower = sheetName.trim().toLowerCase()
      const sh = workbook.Sheets[sheetName]
      if (!sh) continue

      if (u === "B2B-CDNRA" || u === "B2BCDNRA") {
        infoMessages.push(
          `${sheetName.trim()}: B2B-CDNRA (amended notes) detected — not imported in this version.`,
        )
        continue
      }
      if (u === "B2B-DNRA" || u === "B2BDNRA") {
        infoMessages.push(
          `${sheetName.trim()}: B2B-DNRA (amended debit notes) detected — not imported in this version.`,
        )
        continue
      }

      if (u === "B2BA" || u.startsWith("B2BA ")) {
        const matrix = XLSX.utils.sheet_to_json(sh, {
          header: 1,
          defval: "",
          raw: false,
        }) as unknown[][]
        const parsed = parseSheetAsB2BRows(matrix, "B2BA", errors)
        totalParsed += parsed.rawParsed
        b2baRows.push(...parsed.rows)
        continue
      }

      if (u === "B2B-CDNR" || u === "B2BCDNR") {
        const matrix = XLSX.utils.sheet_to_json(sh, {
          header: 1,
          defval: "",
          raw: false,
        }) as unknown[][]
        const parsed = parseSheetAsB2BRows(matrix, "CDNR", errors)
        totalParsed += parsed.rawParsed
        for (const row of parsed.rows) {
          if (row.documentType === "CDNR-DN") cdnrDNRows.push(row)
          else cdnrRows.push(row)
        }
        continue
      }

      if (u === "CDNR" || u.startsWith("CDNR ")) {
        const matrix = XLSX.utils.sheet_to_json(sh, {
          header: 1,
          defval: "",
          raw: false,
        }) as unknown[][]
        const parsed = parseSheetAsB2BRows(matrix, "CDNR", errors)
        totalParsed += parsed.rawParsed
        for (const row of parsed.rows) {
          if (row.documentType === "CDNR-DN") cdnrDNRows.push(row)
          else cdnrRows.push(row)
        }
        continue
      }

      if (lower === "debit notes (original)") {
        const matrix = XLSX.utils.sheet_to_json(sh, {
          header: 1,
          defval: "",
          raw: false,
        }) as unknown[][]
        const parsed = parseSheetAsB2BRows(matrix, "CDNR-DN", errors)
        totalParsed += parsed.rawParsed
        cdnrDNRows = [...cdnrDNRows, ...parsed.rows]
      }
    }

    rows = [...rows, ...b2baRows, ...cdnrRows, ...cdnrDNRows]
  }

  const headersAll = Object.keys(b2bRawRows[0] ?? {}).filter((h) => h.trim() !== "")
  const headers = b2bHeaders.length ? b2bHeaders : headersAll

  if (typSkipped > 0) {
    infoMessages.push(
      `${typSkipped} non-B2B rows (SEZ/Deemed Export) were excluded. Only regular B2B invoices are processed in V1.`,
    )
  }

  const nB2b = rows.filter((r) => r.documentType === "B2B" || r.documentType === undefined).length
  const nB2ba = rows.filter((r) => r.documentType === "B2BA").length
  const nCdnr = rows.filter((r) => r.documentType === "CDNR").length
  const nDn = rows.filter((r) => r.documentType === "CDNR-DN").length
  if (nB2b + nB2ba + nCdnr + nDn > 0) {
    infoMessages.push(
      `Parsed ${nB2b} B2B, ${nB2ba} B2BA, ${nCdnr} Credit Notes, ${nDn} Debit Notes.`,
    )
  }

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
  if (!headers.length && rows.length === 0 && totalParsed === 0) {
    throw new ParseError("File is empty — no data rows found")
  }

  const validationHeaders = headers.length ? headers : headersAll

  if (!rows.length) {
    const nonEmptyBelow = gstr2bMatrix
      ? countNonEmptyDataRowsInMatrix(gstr2bMatrix, gstr2bDataStartRow)
      : 0
    if (nonEmptyBelow === 0) {
      throw new ParseError("File is empty — no data rows found")
    }
    const validation = validateGSTR2BFile(
      b2bRawRows,
      validationHeaders,
      fileIsXlsx,
      foundSheets,
      sheetHints,
      {
        totalRowsParsed: totalParsed,
        skippedRowCount: typSkipped,
        b2bRowCountAfterTypFilter: b2bRawRows.length,
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
    b2bRawRows,
    validationHeaders,
    fileIsXlsx,
    foundSheets,
    sheetHints,
    {
      totalRowsParsed: totalParsed,
      skippedRowCount: typSkipped,
      b2bRowCountAfterTypFilter: b2bRawRows.length,
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
  // Same as case (a) below: nothing but blanks below the header → no row objects.
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

  const identityColumnHeaders = [
    col.supplierGSTIN,
    col.invoiceNumber,
    col.invoiceDate,
  ].filter((h): h is string => Boolean(h))
  const nonEmptyIdentityDataRowsBelowHeader = countPurchaseRegisterIdentityRows(
    rawRows,
    identityColumnHeaders,
  )

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

    let igst = col.igst ? parseNumber(getCell(r, col.igst)) : 0
    let cgst = col.cgst ? parseNumber(getCell(r, col.cgst)) : 0
    let sgst = col.sgst ? parseNumber(getCell(r, col.sgst)) : 0
    let cess = col.cess ? parseNumber(getCell(r, col.cess)) : 0
    if (!col.igst) igst = sumPrLedgerTaxColumns(r, headers, "igst")
    if (!col.cgst) cgst = sumPrLedgerTaxColumns(r, headers, "cgst")
    if (!col.sgst) sgst = sumPrLedgerTaxColumns(r, headers, "sgst")
    if (!col.cess) cess = sumPrLedgerTaxColumns(r, headers, "cess")
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
    // (b) At least one row has identity fields (Date / GSTIN / Invoice No.) but none passed validation.
    if (nonEmptyIdentityDataRowsBelowHeader > 0) {
      throw new ParseError(
        "No valid invoice rows found — check Supplier GSTIN and invoice number columns contain values",
      )
    }
    // (a) No substantive invoice rows (or only totals / amount-only rows) — template / empty export.
    throw new ParseError("File is empty — no data rows found")
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
