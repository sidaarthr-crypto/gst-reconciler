import { findHeaderForAliases } from "@/lib/header-match"
import type { FileValidationConfidence, FileValidationResult } from "@/lib/types"
import {
  PR_INVOICE_NUMBER_ALIASES,
  PR_SUPPLIER_GSTIN_ALIASES,
  PR_TAXABLE_VALUE_ALIASES,
} from "@/lib/pr-column-aliases"
import { normaliseGSTIN } from "@/lib/utils"

const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

function rankConfidence(c: FileValidationConfidence): number {
  if (c === "high") return 3
  if (c === "medium") return 2
  return 1
}

function worseConfidence(
  a: FileValidationConfidence,
  b: FileValidationConfidence,
): FileValidationConfidence {
  return rankConfidence(a) <= rankConfidence(b) ? a : b
}

function parseNumberLoose(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").replace(/₹/g, "").trim()
    if (!cleaned) return null
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function cellString(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return String(value).trim()
}

function parseItcCellStrict(value: unknown): string {
  const s = cellString(value).toUpperCase()
  if (!s) return ""
  if (s === "Y" || s === "N" || s === "T") return s
  return s
}

const GSTR2B_SUPPLIER_ALIASES = [
  "ctin",
  "gstin of supplier",
  "supplier gstin",
  "supplier gst no",
  "gstin",
  "vendor gstin",
  "gstin/uin",
  "gstinofsupplier",
  "party gstin",
] as const

const GSTR2B_INUM_ALIASES = [
  "inum",
  "invoice no",
  "invoice number",
  "inv no",
  "bill no",
  "bill number",
  "document no",
  "ref no",
  "voucher no",
] as const

const GSTR2B_DT_ALIASES = [
  "dt",
  "invoice date",
  "bill date",
  "document date",
  "date",
  "voucher date",
  "doc date",
] as const

const GSTR2B_ITC_ALIASES = [
  "itcavl",
  "itc available",
  "itc avail",
  "itc availability",
  "itc availibility",
  "input tax credit",
] as const

const GSTR2B_TXVAL_ALIASES = [
  "txval",
  "taxable value",
  "taxable value (₹)",
  "taxable value rs",
  "taxable val",
  "taxable amount",
  "taxable",
  "assessable value",
] as const

const GSTR2B_TYP_ALIASES = ["typ", "invoice type", "type", "document type"] as const
const GSTR2B_SUPFILD_ALIASES = [
  "supfildt",
  "supplier filing date",
  "filing date",
  "gstr-1/1a/iff/gstr-5 filing date",
  "gstr-1/5 filling date",
  "gstr-1/5 filing date",
] as const

const PR_SUPPLIER_ALIASES = PR_SUPPLIER_GSTIN_ALIASES
const PR_INVOICE_ALIASES = PR_INVOICE_NUMBER_ALIASES
const PR_TAXABLE_ALIASES = PR_TAXABLE_VALUE_ALIASES

const AMOUNT_ALIASES_IGST = [
  "iamt",
  "igst",
  "igst amount",
  "integrated tax",
  "integrated tax(₹)",
  "integrated tax rs",
] as const
const AMOUNT_ALIASES_CGST = [
  "camt",
  "cgst",
  "cgst amount",
  "central tax",
  "central tax(₹)",
  "central tax rs",
] as const
const AMOUNT_ALIASES_SGST = [
  "samt",
  "sgst",
  "sgst amount",
  "state tax",
  "state ut tax",
  "state/ut tax",
  "state/ut tax(₹)",
] as const

function looksLikeGstr2bByHeaders(headers: string[]): boolean {
  const itc = findHeaderForAliases(headers, GSTR2B_ITC_ALIASES)
  const typ = findHeaderForAliases(headers, GSTR2B_TYP_ALIASES)
  const supf = findHeaderForAliases(headers, GSTR2B_SUPFILD_ALIASES)
  const inum = findHeaderForAliases(headers, GSTR2B_INUM_ALIASES)
  if (itc && (typ || supf)) return true
  if (itc && inum) return true
  return false
}

function looksLikeBasicPurchaseRegister(headers: string[]): boolean {
  const gstin = findHeaderForAliases(headers, PR_SUPPLIER_ALIASES)
  const inv = findHeaderForAliases(headers, PR_INVOICE_ALIASES)
  const tx = findHeaderForAliases(headers, PR_TAXABLE_ALIASES)
  return Boolean(gstin && inv && tx)
}

/** Sheet-level hints from parser (.xlsx workbook or CSV stand-in). */
export type Gstr2bSheetHints = {
  hasB2BSheet: boolean
  supportingCount: number
  sheetWarnings: string[]
  sheetConfidence: FileValidationConfidence
}

function emptyPrValidation(): Pick<
  FileValidationResult,
  "info" | "foundSheets" | "hasB2BSheet" | "b2bRowCount" | "skippedRowCount" | "totalRowsParsed"
> {
  return {
    info: [],
    foundSheets: [],
    hasB2BSheet: false,
    b2bRowCount: 0,
    skippedRowCount: 0,
    totalRowsParsed: 0,
  }
}

export function validateGSTR2BFile(
  rows: Record<string, unknown>[],
  headers: string[],
  fileIsXlsx: boolean,
  foundSheets: string[],
  sheetHints: Gstr2bSheetHints,
  totals: {
    totalRowsParsed: number
    skippedRowCount: number
    b2bRowCountAfterTypFilter: number
  },
  infoMessages: string[],
): FileValidationResult {
  const warnings: string[] = [...sheetHints.sheetWarnings]
  const errors: string[] = []
  const info: string[] = [...infoMessages]

  const baseMeta = {
    info,
    foundSheets: [...foundSheets],
    hasB2BSheet: sheetHints.hasB2BSheet,
    b2bRowCount: totals.b2bRowCountAfterTypFilter,
    skippedRowCount: totals.skippedRowCount,
    totalRowsParsed: totals.totalRowsParsed,
  }

  if (fileIsXlsx && !sheetHints.hasB2BSheet) {
    errors.push(
      "No B2B sheet found. Official GSTR-2B files downloaded from the GSTN portal always contain a sheet named 'B2B'. This file does not appear to be a valid GSTR-2B.",
    )
    return {
      isValid: false,
      confidence: "low",
      warnings,
      errors,
      ...baseMeta,
    }
  }

  if (rows.length === 0 && totals.totalRowsParsed === 0) {
    errors.push("File is empty — no invoice data found")
    return {
      isValid: false,
      confidence: "low",
      warnings,
      errors,
      ...baseMeta,
    }
  }

  if (rows.length === 0 && totals.totalRowsParsed > 0) {
    errors.push(
      "No regular B2B invoices (type R / B2B) found after excluding SEZ and deemed export rows.",
    )
    return {
      isValid: false,
      confidence: "low",
      warnings,
      errors,
      ...baseMeta,
    }
  }

  if (rows.length < 2) {
    warnings.push("Only 1 invoice found — are you sure this is complete?")
  }

  const hasSupplier = findHeaderForAliases(headers, GSTR2B_SUPPLIER_ALIASES)
  const hasInum = findHeaderForAliases(headers, GSTR2B_INUM_ALIASES)
  const hasDt = findHeaderForAliases(headers, GSTR2B_DT_ALIASES)
  const hasItc = findHeaderForAliases(headers, GSTR2B_ITC_ALIASES)
  const hasTxval = findHeaderForAliases(headers, GSTR2B_TXVAL_ALIASES)

  const mandatoryMissingCount = [
    hasSupplier,
    hasInum,
    hasDt,
    hasItc,
    hasTxval,
  ].filter((x) => !x).length

  if (mandatoryMissingCount >= 2) {
    errors.push(
      "Missing key GSTR-2B columns. Official GSTR-2B must have: Supplier GSTIN (ctin), Invoice No (inum), Invoice Date (dt), ITC Available (itcavl), Taxable Value (txval)",
    )
  }

  const supplierKey = hasSupplier
  const itcKey = hasItc
  const dateKey = hasDt
  const txvalKey = hasTxval
  const igstKey = findHeaderForAliases(headers, AMOUNT_ALIASES_IGST)
  const cgstKey = findHeaderForAliases(headers, AMOUNT_ALIASES_CGST)
  const sgstKey = findHeaderForAliases(headers, AMOUNT_ALIASES_SGST)

  if (supplierKey) {
    let valid = 0
    let nonEmpty = 0
    const sample = rows.slice(0, 10)
    for (const row of sample) {
      const raw = cellString(row[supplierKey])
      if (!raw) continue
      nonEmpty++
      const g = normaliseGSTIN(raw)
      if (g && GSTIN_REGEX.test(g)) valid++
    }
    if (nonEmpty > 0 && valid === 0) {
      errors.push(
        "Supplier GSTINs do not match the Indian GSTIN format (e.g. 27AABCU9603R1ZM). Please check if this is the correct file.",
      )
    } else if (nonEmpty > 0 && valid < nonEmpty) {
      warnings.push(
        `${nonEmpty - valid} invoices have invalid GSTIN format. These rows will be skipped during reconciliation.`,
      )
    }
  }

  if (itcKey) {
    let bad = 0
    const sample = rows.slice(0, 20)
    for (const row of sample) {
      const v = parseItcCellStrict(row[itcKey])
      if (!v) continue
      if (v !== "Y" && v !== "N" && v !== "T") bad++
    }
    if (bad > 0) {
      warnings.push(
        "ITC Available column has unexpected values. Expected only Y, N, or T. This may affect risk scoring.",
      )
    }
  }

  if (dateKey) {
    const ddmmyyyy = /^\d{2}-\d{2}-\d{4}$/
    let badFormat = 0
    let checked = 0
    for (const row of rows.slice(0, 10)) {
      const s = cellString(row[dateKey])
      if (!s) continue
      checked++
      if (!ddmmyyyy.test(s)) badFormat++
    }
    if (checked > 0 && badFormat > 0) {
      warnings.push(
        "Invoice dates are not in DD-MM-YYYY format. Date parsing may be affected.",
      )
    }
  }

  const amountKeys = [txvalKey, igstKey, cgstKey, sgstKey].filter(Boolean) as string[]
  if (amountKeys.length > 0) {
    let bad = 0
    for (const row of rows.slice(0, 10)) {
      for (const k of amountKeys) {
        const v = row[k]
        if (v === null || v === undefined || v === "") continue
        if (parseNumberLoose(v) === null) {
          bad++
          break
        }
      }
    }
    if (bad > 0) {
      warnings.push(
        "Some amount columns contain non-numeric values. Check if the file has merged cells or formatting issues.",
      )
    }
  }

  const prLike =
    looksLikeBasicPurchaseRegister(headers) &&
    !findHeaderForAliases(headers, GSTR2B_ITC_ALIASES)
  if (prLike && rows.length > 0) {
    errors.push(
      "This file looks like a Purchase Register, not GSTR-2B. Upload it in the Purchase Register slot.",
    )
  }

  const isValid = errors.length === 0

  const gstinOk =
    Boolean(supplierKey) &&
    rows.slice(0, 10).some((row) => {
      const g = normaliseGSTIN(cellString(row[supplierKey!]))
      return Boolean(g && GSTIN_REGEX.test(g))
    })

  let columnConfidence: FileValidationConfidence = "low"
  if (mandatoryMissingCount < 2 && gstinOk) {
    columnConfidence = "high"
  } else if (mandatoryMissingCount < 4) {
    columnConfidence = "medium"
  }

  let confidence: FileValidationConfidence = "low"
  if (isValid) {
    confidence = worseConfidence(sheetHints.sheetConfidence, columnConfidence)
  }

  return {
    isValid,
    confidence,
    warnings,
    errors,
    ...baseMeta,
  }
}

export function validatePurchaseRegister(
  rows: Record<string, unknown>[],
  headers: string[],
): FileValidationResult {
  const warnings: string[] = []
  const errors: string[] = []
  const prMeta = emptyPrValidation()
  prMeta.totalRowsParsed = rows.length
  prMeta.b2bRowCount = rows.length

  if (rows.length === 0) {
    errors.push("File is empty — no invoice data found")
    return { isValid: false, confidence: "low", warnings, errors, ...prMeta }
  }

  if (rows.length < 2) {
    warnings.push("Only 1 invoice found — are you sure this is complete?")
  }

  const gstinKey = findHeaderForAliases(headers, [...PR_SUPPLIER_ALIASES])
  const invKey = findHeaderForAliases(headers, [...PR_INVOICE_ALIASES])
  const txKey = findHeaderForAliases(headers, [...PR_TAXABLE_ALIASES])

  if (!gstinKey) {
    errors.push("Missing Supplier GSTIN column (e.g. Supplier GSTIN, GSTIN).")
  }
  if (!invKey) {
    errors.push("Missing Invoice Number column (e.g. Invoice No, Bill No).")
  }
  if (!txKey) {
    errors.push("Missing Taxable Value column (e.g. Taxable Value, Taxable Amount).")
  }

  if (findHeaderForAliases(headers, GSTR2B_ITC_ALIASES)) {
    warnings.push(
      "This file contains an ITC Available column which is typically only in GSTR-2B files. Make sure you uploaded the correct file.",
    )
  }

  if (looksLikeGstr2bByHeaders(headers) && rows.length > 0) {
    errors.push(
      "This file looks like GSTR-2B, not a Purchase Register. Upload it in the GSTR-2B slot.",
    )
  }

  if (gstinKey) {
    let valid = 0
    let nonEmpty = 0
    for (const row of rows.slice(0, 20)) {
      const raw = cellString(row[gstinKey])
      if (!raw) continue
      nonEmpty++
      const g = normaliseGSTIN(raw)
      if (g && GSTIN_REGEX.test(g)) valid++
    }
    if (nonEmpty >= 5 && valid === 0) {
      warnings.push(
        "Most Supplier GSTINs appear invalid. Reconciliation accuracy will be affected.",
      )
    }
  }

  const isValid = errors.length === 0
  let confidence: FileValidationConfidence = isValid ? "high" : "low"
  if (isValid && warnings.length > 0) confidence = "medium"

  return {
    isValid,
    confidence,
    warnings,
    errors,
    ...prMeta,
  }
}
