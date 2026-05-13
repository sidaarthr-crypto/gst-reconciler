import {
  ParseError,
  parseITCStatus,
  parseNumber,
  parseReturnPeriodToMonthYear,
  parseReverseCharge,
} from "@/lib/parser"
import type { FileValidationResult, GSTR2BRow, ParseResult } from "@/lib/types"
import { normaliseGSTIN } from "@/lib/utils"

const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

type ItmDet = {
  txval?: unknown
  iamt?: unknown
  camt?: unknown
  samt?: unknown
  csamt?: unknown
}

type PortalItm = {
  num?: unknown
  itm_det?: ItmDet
}

type PortalInv = {
  inum?: unknown
  idt?: unknown
  val?: unknown
  pos?: unknown
  rchrg?: unknown
  itcavl?: unknown
  rsn?: unknown
  itms?: PortalItm[]
}

type PortalB2B = {
  ctin?: unknown
  trdnm?: unknown
  cfs?: unknown
  fldtr1?: unknown
  flprdr1?: unknown
  inv?: PortalInv[]
}

type PortalData = {
  gstin?: unknown
  rtnprd?: unknown
  b2b?: unknown
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
}

function gstr2bJsonValidation(
  rowCount: number,
  totalParsed: number,
): FileValidationResult {
  return {
    isValid: rowCount > 0,
    confidence: "high",
    warnings: rowCount < 2 && rowCount > 0 ? ["Only 1 invoice found — are you sure this is complete?"] : [],
    errors:
      rowCount === 0
        ? ["No B2B invoice rows found in this JSON file. Check that the export contains data.b2b entries."]
        : [],
    info: [],
    foundSheets: [],
    hasB2BSheet: true,
    b2bRowCount: rowCount,
    skippedRowCount: 0,
    totalRowsParsed: totalParsed,
  }
}

/**
 * Parse official GSTR-2B JSON from GSTN portal (`data.b2b[]` → flat invoice rows).
 * Output shape matches {@link parseGSTR2BFile} for downstream reconciliation.
 */
export async function parseGstr2bJson(file: File): Promise<ParseResult<GSTR2BRow>> {
  let root: unknown
  try {
    root = JSON.parse(await file.text())
  } catch {
    throw new ParseError("Could not read this file as JSON. Export GSTR-2B JSON again from the GSTN portal.")
  }

  if (!isRecord(root)) {
    throw new ParseError(
      "Invalid GSTR-2B JSON: missing data.b2b. Please download the JSON from the GSTN portal.",
    )
  }

  const dataRaw = root.data
  if (!isRecord(dataRaw)) {
    throw new ParseError(
      "Invalid GSTR-2B JSON: missing data.b2b. Please download the JSON from the GSTN portal.",
    )
  }

  const data = dataRaw as PortalData
  if (!Array.isArray(data.b2b)) {
    throw new ParseError(
      "Invalid GSTR-2B JSON: missing data.b2b. Please download the JSON from the GSTN portal.",
    )
  }

  const recipientGSTINRaw = data.gstin != null ? String(data.gstin).trim() : ""
  const recipientGSTIN = recipientGSTINRaw
    ? GSTIN_REGEX.test(normaliseGSTIN(recipientGSTINRaw))
      ? normaliseGSTIN(recipientGSTINRaw)
      : null
    : null

  const returnPeriod = data.rtnprd != null ? String(data.rtnprd).trim() : null
  const detected = parseReturnPeriodToMonthYear(returnPeriod)

  const errors: string[] = []
  const rows: GSTR2BRow[] = []
  let totalInvoicesSeen = 0

  for (const sup of data.b2b) {
    if (!isRecord(sup)) continue
    const s = sup as PortalB2B
    const ctin = String(s.ctin ?? "").trim()
    const trdnm = String(s.trdnm ?? "").trim()
    const fldtr1 = String(s.fldtr1 ?? "").trim()
    const flprdr1 = String(s.flprdr1 ?? "").trim()
    const filingPeriod = flprdr1 || undefined
    const invList = Array.isArray(s.inv) ? s.inv : []

    for (const invRaw of invList) {
      if (!isRecord(invRaw)) continue
      const inv = invRaw as PortalInv
      totalInvoicesSeen++

      const inum = String(inv.inum ?? "").trim()
      const idt = String(inv.idt ?? "").trim()
      if (!ctin || ctin === "-" || !inum || inum === "-") continue

      const gstinNorm = normaliseGSTIN(ctin)
      if (!GSTIN_REGEX.test(gstinNorm)) {
        errors.push(
          `GSTIN "${ctin}" does not match the standard 15-character GSTIN format — please verify with the supplier.`,
        )
      }

      const itms = Array.isArray(inv.itms) ? inv.itms : []
      let txval = 0
      let igst = 0
      let cgst = 0
      let sgst = 0
      let cess = 0

      if (itms.length === 0) {
        txval = parseNumber(inv.val)
        igst = 0
        cgst = 0
        sgst = 0
        cess = 0
      } else {
        for (const itm of itms) {
          if (!isRecord(itm)) continue
          const det = (itm as PortalItm).itm_det
          if (!isRecord(det)) continue
          txval += parseNumber(det.txval)
          igst += parseNumber(det.iamt)
          cgst += parseNumber(det.camt)
          sgst += parseNumber(det.samt)
          cess += parseNumber(det.csamt)
        }
      }

      if (txval === 0) {
        errors.push(`Warning: Invoice ${inum} has taxable value ₹0 — please verify this is intentional.`)
      }

      const invoiceVal = parseNumber(inv.val)
      const invoiceValue =
        invoiceVal > 0 ? invoiceVal : txval + igst + cgst + sgst + cess

      const posRaw = inv.pos
      const placeOfSupply = posRaw != null ? String(posRaw).trim() : ""

      rows.push({
        supplierGSTIN: ctin,
        supplierName: trdnm,
        supplierFilingDate: fldtr1,
        supprd: filingPeriod,
        supplierFilingPeriod: filingPeriod,
        invoiceNumber: inum,
        rawInvoiceNumber: inum,
        invoiceType: "B2B",
        documentType: "B2B",
        invoiceDate: idt,
        dt: idt || undefined,
        invoiceValue,
        placeOfSupply,
        reverseCharge: parseReverseCharge(inv.rchrg),
        itcAvailable: parseITCStatus(inv.itcavl),
        itcUnavailableReason: inv.rsn != null ? String(inv.rsn).trim() : undefined,
        taxableValue: txval,
        igst,
        cgst,
        sgst,
        cess,
        taxRate: 0,
      })
    }
  }

  const validation = gstr2bJsonValidation(rows.length, totalInvoicesSeen)

  return {
    rows: validation.isValid ? rows : [],
    filename: file.name,
    rowCount: validation.isValid ? rows.length : 0,
    errors,
    totalParsed: totalInvoicesSeen,
    skipped: 0,
    validation,
    recipientGSTIN,
    recipientName: null,
    returnPeriod: returnPeriod || null,
    detectedMonth: detected?.month ?? null,
    detectedYear: detected?.year ?? null,
  }
}
