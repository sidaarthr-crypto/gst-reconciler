import type {
  ActionUrgency,
  AppConfig,
  DocumentType,
  GSTR2BRow,
  ITCBlockReason,
  ITCStatus,
  ITCRiskLevel,
  MismatchStatus,
  PurchaseRegisterRow,
  ReconciliationRow,
  ReconciliationSummary,
} from "@/lib/types"
import {
  buildSuggestedMatchReason,
  formatINR,
  fuzzyMatchScore,
  getMonthName,
  getRiskSortOrder,
  getStatusSortPriority,
  inferTaxRatePR,
  normalizeGstRatePercent,
  normaliseGSTIN,
  parseInvoiceDateFlexible,
  parsePlaceOfSupplyState,
} from "@/lib/utils"

/** Invoice normalisation for all reconciliation key construction and comparisons. */
export function normaliseInvoiceNumber(inv: string): string {
  if (!inv) return ""
  return inv
    .toUpperCase()
    .trim()
    .replace(/\/\d{4}-\d{2,4}$/, "")
    .replace(/[\/\\\s]+/g, "-")
    .replace(/-0+(\d)/g, "-$1")
    .replace(/-+/g, "-")
    .trim()
}

export function reconcileMatchKey(gstin: string, invoiceNo: string): string {
  return `${normaliseGSTIN(gstin)}||${normaliseInvoiceNumber(invoiceNo)}`
}

/** GSTR-2B invoice date is `dt` — never supplier filing date (`supfildt`). */
function getB2bInvoiceDateForMatching(b2b: GSTR2BRow): string {
  const fromDt = String(b2b.dt ?? "").trim()
  if (fromDt) return fromDt
  return String(b2b.invoiceDate ?? "").trim()
}

/**
 * Q-14: taxable values must agree; then either same implied GST% on taxable (same rate, less booked)
 * or GST totals look like intentional partial fractions (25/50/75%) of portal GST — not a wrong-rate value mismatch.
 */
function partialBookingTaxPatternHolds(
  b2b: GSTR2BRow,
  pr: PurchaseRegisterRow,
  tol: number,
): boolean {
  if (Math.abs(b2b.taxableValue - pr.taxableValue) > tol) return false
  const tb = b2b.taxableValue
  const tp = pr.taxableValue
  if (tb <= 0 || tp <= 0) return false
  const g2b = b2b.igst + b2b.cgst + b2b.sgst
  const gp = pr.igst + pr.cgst + pr.sgst
  const p2b = (g2b / tb) * 100
  const ppr = (gp / tp) * 100
  if (Math.abs(p2b - ppr) <= 0.35) return true
  if (g2b <= tol) return false
  const ratio = gp / g2b
  if (ratio <= 0 || ratio >= 1) return false
  const near = (x: number) => Math.abs(ratio - x) < 0.06
  return near(0.25) || near(0.5) || near(0.75)
}

function rawInvoiceExactEqual(b2b: GSTR2BRow, pr: PurchaseRegisterRow): boolean {
  const a = String(b2b.rawInvoiceNumber ?? b2b.invoiceNumber).trim()
  const b = String(pr.rawInvoiceNumber ?? pr.invoiceNumber).trim()
  return a === b
}

/** M-1: every core amount incl. CESS within ₹1 tolerance. */
function m1CoreAmountsMatch(b2b: GSTR2BRow, pr: PurchaseRegisterRow, tol: number): boolean {
  if (Math.abs(b2b.taxableValue - pr.taxableValue) > tol) return false
  if (Math.abs(b2b.igst - pr.igst) > tol) return false
  if (Math.abs(b2b.cgst - pr.cgst) > tol) return false
  if (Math.abs(b2b.sgst - pr.sgst) > tol) return false
  if (Math.abs((b2b.cess ?? 0) - (pr.cess ?? 0)) > tol) return false
  return true
}

function reconPeriodSupprdDigits(month: number, year: number): string {
  return `${String(month).padStart(2, "0")}${year}`
}

function supprdNotCurrentPeriod(
  b2b: GSTR2BRow,
  recMonth: number | undefined,
  recYear: number | undefined,
): boolean {
  if (recMonth == null || recYear == null) return false
  const raw = getGstr2bSupprdRaw(b2b)
  if (!raw) return false
  const s = normalizeSupprdDigits(raw)
  if (s.length < 6) return false
  return s !== reconPeriodSupprdDigits(recMonth, recYear)
}

function getPrBookedItcAmount(pr: PurchaseRegisterRow): number | null {
  if (pr.itcAmount === undefined || pr.itcAmount === null) return null
  if (!Number.isFinite(pr.itcAmount)) return null
  return pr.itcAmount
}

/** POS state code: explicit `pos` on 2B row when mapped, else placeOfSupply. */
function getB2bPlaceOfSupplyStateCode(b2b: GSTR2BRow): number | null {
  const ext = b2b as GSTR2BRow & { pos?: string }
  const raw = ext.pos ?? b2b.placeOfSupply
  return parsePlaceOfSupplyState(raw)
}

const POS_TAX_EPS = 1

/** Interstate vs intrastate from supplier GSTIN vs POS; compare tax components on GSTR-2B (Round 2). */
function shouldFlagPOSMismatch(b2b: GSTR2BRow): boolean {
  const supplierState = Number.parseInt(b2b.supplierGSTIN.slice(0, 2), 10)
  const posState = getB2bPlaceOfSupplyStateCode(b2b)
  if (posState === null || !Number.isFinite(supplierState)) return false

  const isInterstate = supplierState !== posState
  const usesIGST = (b2b.igst ?? 0) > POS_TAX_EPS
  const usesCGSTSGST = (b2b.cgst ?? 0) > POS_TAX_EPS || (b2b.sgst ?? 0) > POS_TAX_EPS

  if (isInterstate && usesCGSTSGST && !usesIGST) return true
  if (!isInterstate && usesIGST && !usesCGSTSGST) return true
  return false
}

/** M-5: same numeric core on invoice numbers → formatting variant; else let P-2 handle unrelated strings. */
function invoiceNumbersLookLikeFormattingVariant(invB: string, invP: string): boolean {
  const digits = (s: string) => s.replace(/\D/g, "")
  const dB = digits(invB)
  const dP = digits(invP)
  if (dB.length < 4 || dP.length < 4) return false
  return dB === dP || dB.includes(dP) || dP.includes(dB)
}

const GST_QUARTER_RETURN_START_MONTHS = [1, 4, 7, 10]

function isGstQuarterReturnStartMonth(month: number): boolean {
  return GST_QUARTER_RETURN_START_MONTHS.includes(month)
}

function normalizeSupprdDigits(supprd: string): string {
  return supprd.replace(/[^0-9]/g, "")
}

/** Coerce UI/API period so `10 === reconciliationMonth` is never broken by string `"10"`. */
function normalizeReconciliationPeriod(
  period?: { month: number; year: number },
): { month: number; year: number } | undefined {
  if (!period) return undefined
  const month = Number.parseInt(String(period.month), 10)
  const year = Number.parseInt(String(period.year), 10)
  if (!Number.isFinite(month) || !Number.isFinite(year)) return undefined
  return { month, year }
}

/** GSTR-2B filing period (`supprd`): column may map to `supplierFilingPeriod` or `supprd`. */
function getGstr2bSupprdRaw(b2bRow: GSTR2BRow): string {
  const raw = b2bRow.supplierFilingPeriod ?? b2bRow.supprd
  if (raw === undefined || raw === null) return ""
  return String(raw).trim()
}

/**
 * True when `supprd` is a standard quarter-start return month (01/04/07/10).
 * Monthly filers in Jan/Apr/Jul/Oct use the same MM prefix — use
 * {@link isQRMPInvoice} with reconciliation month/year for QRMP detection.
 */
export function isQRMPSupplier(supprd: string): boolean {
  const clean = normalizeSupprdDigits((supprd ?? "").trim())
  if (clean.length < 6) return false
  const month = Number.parseInt(clean.substring(0, 2), 10)
  if (!Number.isFinite(month)) return false
  return isGstQuarterReturnStartMonth(month)
}

/**
 * QRMP: quarterly filing period (`supprd` month 01/04/07/10) differs from the
 * reconciliation month/year. Invoice date is not required — trust `supprd`.
 */
export function isQRMPInvoice(
  b2bRow: GSTR2BRow,
  reconciliationMonth: number,
  reconciliationYear: number,
): boolean {
  const supprd = b2bRow.supplierFilingPeriod ?? b2bRow.supprd
  if (!supprd) return false

  const clean = String(supprd).replace(/[^0-9]/g, "")
  if (clean.length < 6) return false

  const sm = Number.parseInt(clean.substring(0, 2), 10)
  const sy = Number.parseInt(clean.substring(2, 6), 10)
  if (Number.isNaN(sm) || Number.isNaN(sy)) return false

  const rm = Number(reconciliationMonth)
  const ry = Number(reconciliationYear)
  if (!Number.isFinite(rm) || !Number.isFinite(ry)) return false

  if (sm === rm && sy === ry) return false

  if (![1, 4, 7, 10].includes(sm)) return false

  return true
}

function resolveB2BForRow(row: ReconciliationRow, map2B: Map<string, GSTR2BRow>): GSTR2BRow | undefined {
  const direct = map2B.get(row.matchKey)
  if (direct) return direct
  const g = row.supplierGSTIN.trim()
  if (!g) return undefined
  for (const b of map2B.values()) {
    if (b.supplierGSTIN.trim() !== g) continue
    if (reconcileMatchKey(b.supplierGSTIN, b.invoiceNumber) === row.matchKey) return b
  }
  for (const b of map2B.values()) {
    if (b.supplierGSTIN.trim() !== g) continue
    if (fuzzyMatchScore(b.invoiceNumber, row.invoiceNumber) >= 75) return b
  }
  return undefined
}

function applyCrossPeriodQrmpOverrides(
  results: ReconciliationRow[],
  map2B: Map<string, GSTR2BRow>,
  recMonth: number | undefined,
  recYear: number | undefined,
): void {
  if (recMonth == null || recYear == null) return
  const rm = Number(recMonth)
  const ry = Number(recYear)

  for (const row of results) {
    if (row.status !== "In 2B Only") continue

    const b2b = map2B.get(row.matchKey) ?? resolveB2BForRow(row, map2B)
    if (!b2b) continue
    if (b2b.itcAvailable === "N") continue

    const invB2b = String(b2b.invoiceDate ?? "").trim()
    const effectiveInvoiceDate = invB2b || String(row.invoiceDate ?? "").trim()

    const b2bRow: GSTR2BRow =
      invB2b === "" && effectiveInvoiceDate !== ""
        ? { ...b2b, invoiceDate: effectiveInvoiceDate }
        : b2b

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console -- QRMP call-site diagnostics
      console.log("About to QRMP check:", {
        invoice: row.invoiceNumber,
        currentStatus: row.status,
        willCheck: row.status === "In 2B Only",
      })
    }

    const qrmp = supprdNotCurrentPeriod(b2bRow, rm, ry)
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console -- QRMP call-site diagnostics
      console.log("QRMP result for", row.invoiceNumber, ":", qrmp)
    }
    if (!qrmp) continue

    row.status = "QRMP Delay"
    row.itcRisk = "Low"
    row.isQRMP = true
    row.actionUrgency = "Monitor"
    row.totalITCAtRisk = 0
    row.qrmpNote =
      "QRMP supplier with quarterly filing — invoice appears under a prior quarter return period relative to this reconciliation month."
    row.recommendedAction =
      `QRMP supplier. Invoice will appear in next quarter GSTR-2B. Do NOT claim ITC this month.`
  }
}

export function checkIfQRMPFromSameSupplier(
  supplierGSTIN: string,
  rows2b: GSTR2BRow[],
  reconciliationMonth?: number,
  reconciliationYear?: number,
): boolean {
  if (reconciliationMonth == null || reconciliationYear == null) return false
  const m = Number.parseInt(String(reconciliationMonth), 10)
  const y = Number.parseInt(String(reconciliationYear), 10)
  if (!Number.isFinite(m) || !Number.isFinite(y)) return false
  const norm = supplierGSTIN.trim()
  for (const r of rows2b) {
    if (r.supplierGSTIN.trim() !== norm) continue
    if (!getGstr2bSupprdRaw(r)) continue
    if (r.itcAvailable === "N") continue
    if (isQRMPInvoice(r, m, y)) return true
  }
  return false
}

/** Invoice in recon month or prior month → may still be filing / QRMP timing. */
export function isLikelyTimingDelay(
  invoiceDate: string,
  reconciliationMonth: number,
  reconciliationYear: number,
): boolean {
  const id = parseInvoiceDateFlexible(invoiceDate)
  if (!id) return false
  const invYM = id.getFullYear() * 12 + id.getMonth()
  const recYM = reconciliationYear * 12 + (reconciliationMonth - 1)
  const diff = recYM - invYM
  return diff >= 0 && diff <= 1
}

function qrmpExpectedGstr2BMonthLabel(invoiceDate: string): string {
  const id = parseInvoiceDateFlexible(invoiceDate)
  if (!id) return "the next quarter-end"
  const m = id.getMonth() + 1
  const y = id.getFullYear()
  let endMonth: number
  if (m >= 4 && m <= 6) endMonth = 6
  else if (m >= 7 && m <= 9) endMonth = 9
  else if (m >= 10 && m <= 12) endMonth = 12
  else endMonth = 3
  return `${getMonthName(endMonth)} ${y}`
}

function getITCDeadline(invoiceDate: string): {
  deadlineStr: string
  daysRemaining: number
  isExpired: boolean
  isWarning: boolean
} | null {
  if (!invoiceDate) return null

  try {
    const parsed = parseInvoiceDateFlexible(invoiceDate)
    if (!parsed) return null
    const month = parsed.getMonth() + 1
    const year = parsed.getFullYear()
    const fyEndYear = month >= 4 ? year + 1 : year
    const deadline = new Date(fyEndYear, 10, 30)

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    deadline.setHours(0, 0, 0, 0)

    const daysRemaining = Math.floor(
      (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    )

    return {
      deadlineStr: `30 Nov ${fyEndYear}`,
      daysRemaining,
      isExpired: daysRemaining < 0,
      isWarning: daysRemaining >= 0 && daysRemaining <= 60,
    }
  } catch {
    return null
  }
}

function resolveInvoiceDateForDeadline(
  b2b: GSTR2BRow | undefined,
  pr: PurchaseRegisterRow | undefined,
): string {
  const candidates = [
    (b2b ? getB2bInvoiceDateForMatching(b2b) : "").trim(),
    (pr?.invoiceDate ?? "").trim(),
    (b2b?.invoiceDate ?? "").trim(),
  ]
  for (const value of candidates) {
    if (!value) continue
    if (parseInvoiceDateFlexible(value)) return value
  }
  return candidates.find((value) => value.length > 0) ?? ""
}

function applyITCDeadlineFieldsAndEscalation(
  status: MismatchStatus,
  invoiceDateStr: string,
  /** Amount shown in the Section 16(4) banner (e.g. full 2B ITC when matched row has ₹0 “at risk”). */
  itcAmountForDeadlineNotice: number,
  extras: ReturnType<typeof defaultRowFields>,
  mut: { itcRisk: ITCRiskLevel; action: string },
): void {
  if (!invoiceDateStr.trim()) return
  const meta = getITCDeadline(invoiceDateStr.trim())
  if (!meta) return

  extras.itcClaimDeadline = meta.deadlineStr
  extras.daysToDeadline = meta.daysRemaining
  extras.isDeadlineWarning = meta.isWarning
  extras.isDeadlineExpired = meta.isExpired

  if (meta.isExpired && status !== "Duplicate") {
    mut.itcRisk = "Critical"
    mut.action =
      `⚠️ ITC CLAIM DEADLINE EXPIRED. Deadline was ${meta.deadlineStr}. This ITC of ${formatINR(itcAmountForDeadlineNotice)} can no longer be claimed under Section 16(4). ` +
      mut.action
  } else if (meta.isWarning && !meta.isExpired) {
    if (mut.itcRisk === "Medium") mut.itcRisk = "High"
    mut.action =
      `⏰ Only ${meta.daysRemaining} days left to claim this ITC (deadline: ${meta.deadlineStr}). Act urgently. ` +
      mut.action
  }
}

function detectDuplicateKeys<T extends { supplierGSTIN: string; invoiceNumber: string }>(
  rows: T[],
): Set<string> {
  const count = new Map<string, number>()
  for (const r of rows) {
    const k = reconcileMatchKey(r.supplierGSTIN, r.invoiceNumber)
    count.set(k, (count.get(k) ?? 0) + 1)
  }
  const dup = new Set<string>()
  for (const [k, n] of count) {
    if (n > 1) dup.add(k)
  }
  return dup
}

/** First row per duplicate key stays in `primary`; extra rows go to `extras` (duplicate-only). */
function partitionRowsByDuplicateKey<T extends { supplierGSTIN: string; invoiceNumber: string }>(
  rows: T[],
): { primary: T[]; extras: T[] } {
  const dupKeys = detectDuplicateKeys(rows)
  const seen = new Set<string>()
  const primary: T[] = []
  const extras: T[] = []
  for (const r of rows) {
    const k = reconcileMatchKey(r.supplierGSTIN, r.invoiceNumber)
    if (!dupKeys.has(k)) {
      primary.push(r)
      continue
    }
    if (!seen.has(k)) {
      seen.add(k)
      primary.push(r)
    } else {
      extras.push(r)
    }
  }
  return { primary, extras }
}

function applyItcAvailabilityStatus(
  status: MismatchStatus,
  b2b: GSTR2BRow | undefined,
): { status: MismatchStatus; itcBlockReason: ITCBlockReason } {
  if (!b2b) return { status, itcBlockReason: null }
  if (b2b.itcAvailable === "N") {
    const code = extractItcBlockCode(b2b.itcUnavailableReason)
    let br: ITCBlockReason = null
    if (code === "P") br = "permanent"
    else if (code === "C") br = "conditional"
    return { status: "ITC Blocked", itcBlockReason: br }
  }
  if (b2b.itcAvailable === "T") {
    return { status: "ITC Temporary", itcBlockReason: null }
  }
  return { status, itcBlockReason: null }
}

function taxRatesDisagree(b2b: GSTR2BRow, pr: PurchaseRegisterRow): boolean {
  const tr2 = normalizeGstRatePercent(b2b.taxRate)
  const trp =
    pr.taxRate !== undefined && Number.isFinite(pr.taxRate) && pr.taxRate > 0
      ? normalizeGstRatePercent(pr.taxRate)
      : inferTaxRatePR(pr)
  if (tr2 === null || trp === null) return false
  return Math.abs(tr2 - trp) > 0.5
}

function firstInvoiceForKey<T extends { supplierGSTIN: string; invoiceNumber: string }>(
  rows: T[],
  key: string,
): string {
  const r = rows.find((x) => reconcileMatchKey(x.supplierGSTIN, x.invoiceNumber) === key)
  return r?.invoiceNumber ?? ""
}

/** True when total tax matches but one side is IGST vs the other CGST+SGST (wrong tax type). */
function detectTaxTypeMismatch(b2b: GSTR2BRow, pr: PurchaseRegisterRow): boolean {
  const total2B = b2b.igst + b2b.cgst + b2b.sgst
  const totalPR = pr.igst + pr.cgst + pr.sgst
  if (Math.abs(total2B - totalPR) > 1) return false
  const typeSwitch =
    (b2b.igst > 0 && pr.igst === 0 && (pr.cgst > 0 || pr.sgst > 0)) ||
    (pr.igst > 0 && b2b.igst === 0 && (b2b.cgst > 0 || b2b.sgst > 0))
  return typeSwitch
}

function valuesWithinFuzzyTolerance(b2b: GSTR2BRow, pr: PurchaseRegisterRow, tol: number): boolean {
  const tax2 = b2b.igst + b2b.cgst + b2b.sgst
  const taxP = pr.igst + pr.cgst + pr.sgst
  return Math.abs(b2b.taxableValue - pr.taxableValue) <= tol && Math.abs(tax2 - taxP) <= tol
}

function extractItcBlockCode(reason: string | undefined): string {
  if (!reason) return ""
  const t = reason.trim().toUpperCase()
  if (t.startsWith("P") || t === "P") return "P"
  if (t.startsWith("C") || t === "C") return "C"
  return ""
}

function defaultRowFields(): Pick<
  ReconciliationRow,
  | "isTaxTypeMismatch"
  | "totalTax2B"
  | "totalTaxPR"
  | "isSuggestedMatch"
  | "matchConfidence"
  | "suggestedMatchReason"
  | "isDuplicate"
  | "duplicateOf"
  | "isRCM"
  | "itcBlockReason"
  | "itcClaimDeadline"
  | "daysToDeadline"
  | "isDeadlineWarning"
  | "isDeadlineExpired"
  | "isPOSMismatch"
  | "posWarning"
  | "taxRate2B"
  | "taxRatePR"
  | "isTaxRateMismatch"
  | "cessDiff"
  | "isCessMismatch"
  | "isTimingMismatch"
  | "timingNote"
  | "isQRMP"
  | "qrmpNote"
> {
  return {
    isTaxTypeMismatch: false,
    totalTax2B: null,
    totalTaxPR: null,
    isSuggestedMatch: false,
    matchConfidence: null,
    suggestedMatchReason: null,
    isDuplicate: false,
    duplicateOf: null,
    isRCM: false,
    itcBlockReason: null,
    itcClaimDeadline: null,
    daysToDeadline: null,
    isDeadlineWarning: false,
    isDeadlineExpired: false,
    isPOSMismatch: false,
    posWarning: null,
    taxRate2B: null,
    taxRatePR: null,
    isTaxRateMismatch: false,
    cessDiff: null,
    isCessMismatch: false,
    isTimingMismatch: false,
    timingNote: null,
    isQRMP: false,
    qrmpNote: null,
  }
}

function determineBaseStatus(
  b2b: GSTR2BRow | undefined,
  pr: PurchaseRegisterRow | undefined,
  tolerance: number,
): MismatchStatus {
  if (b2b && !pr) return "In 2B Only"
  if (!b2b && pr) return "In PR Only"

  const taxableDiff = Math.abs(b2b!.taxableValue - pr!.taxableValue)
  const igst2B = b2b!.igst
  const cgst2B = b2b!.cgst
  const sgst2B = b2b!.sgst
  const igstPR = pr!.igst
  const cgstPR = pr!.cgst
  const sgstPR = pr!.sgst

  const absIgst = Math.abs(igst2B - igstPR)
  const absCgst = Math.abs(cgst2B - cgstPR)
  const absSgst = Math.abs(sgst2B - sgstPR)
  const totalTaxDiff = absIgst + absCgst + absSgst

  const total2B = igst2B + cgst2B + sgst2B
  const totalPR = igstPR + cgstPR + sgstPR
  const totalsClose = Math.abs(total2B - totalPR) <= 1

  if (b2b!.itcAvailable === "Y" && total2B + tolerance < totalPR) {
    return "ITC Reduced by Supplier"
  }
  if (
    totalPR > tolerance &&
    total2B > totalPR + tolerance &&
    totalPR < total2B * 0.9 &&
    total2B - totalPR > tolerance &&
    taxableDiff <= tolerance &&
    !taxRatesDisagree(b2b!, pr!) &&
    partialBookingTaxPatternHolds(b2b!, pr!, tolerance)
  ) {
    return "Partially Booked ITC"
  }

  const cess2B = b2b!.cess ?? 0
  const cessPR = pr!.cess ?? 0
  if (
    taxableDiff <= tolerance &&
    totalTaxDiff <= tolerance &&
    Math.abs(cess2B - cessPR) > tolerance
  ) {
    return "CESS Mismatch"
  }

  const typeSwitch =
    (igst2B > 0 && igstPR === 0 && (cgstPR > 0 || sgstPR > 0)) ||
    (igstPR > 0 && igst2B === 0 && (cgst2B > 0 || sgst2B > 0))

  if (taxableDiff <= tolerance && totalTaxDiff > tolerance) {
    if (totalsClose && typeSwitch) {
      return "Tax Type Mismatch"
    }

    const tr2Explicit = normalizeGstRatePercent(b2b!.taxRate)
    const trpExplicit =
      pr!.taxRate !== undefined && Number.isFinite(pr!.taxRate) && pr!.taxRate > 0
        ? normalizeGstRatePercent(pr!.taxRate)
        : null

    if (
      tr2Explicit !== null &&
      trpExplicit !== null &&
      tr2Explicit > 0 &&
      trpExplicit > 0 &&
      Math.abs(tr2Explicit - trpExplicit) > 0.5
    ) {
      return "Tax Rate Mismatch"
    }

    return "Value Mismatch"
  }

  if (taxableDiff > tolerance) {
    return "Value Mismatch"
  }

  return "Matched"
}

function calcITCAtRisk(
  status: MismatchStatus,
  b2b: GSTR2BRow | undefined,
  pr: PurchaseRegisterRow | undefined,
  diffs: { igst: number; cgst: number; sgst: number },
): number {
  switch (status) {
    case "Matched":
    case "Suggested Match":
      return 0
    case "Sec 16(4) Expired":
      return b2b ? b2b.igst + b2b.cgst + b2b.sgst : 0
    case "ITC Blocked":
      return b2b ? b2b.igst + b2b.cgst + b2b.sgst : 0
    case "ITC Temporary":
      return b2b ? b2b.igst + b2b.cgst + b2b.sgst : 0
    case "POS Mismatch":
      return b2b ? b2b.igst + b2b.cgst + b2b.sgst : 0
    case "CESS Mismatch":
      return b2b && pr ? Math.abs((b2b.cess ?? 0) - (pr.cess ?? 0)) : 0
    case "Tax Rate Mismatch":
      return Math.abs(diffs.igst) + Math.abs(diffs.cgst) + Math.abs(diffs.sgst)
    case "Tax Type Mismatch":
      return Math.abs(diffs.igst) + Math.abs(diffs.cgst) + Math.abs(diffs.sgst)
    case "In 2B Only":
      return b2b ? b2b.igst + b2b.cgst + b2b.sgst : 0
    case "In PR Only":
    case "Period Timing Mismatch":
      return pr ? pr.igst + pr.cgst + pr.sgst : 0
    case "QRMP Delay":
      return 0
    case "Value Mismatch":
      return Math.abs(diffs.igst) + Math.abs(diffs.cgst) + Math.abs(diffs.sgst)
    case "Duplicate":
      if (b2b) return b2b.igst + b2b.cgst + b2b.sgst
      return pr ? pr.igst + pr.cgst + pr.sgst : 0
    case "RCM Invoice":
      return b2b ? b2b.igst + b2b.cgst + b2b.sgst : 0
    case "Date Gap Match":
    case "Group Entity Match":
    case "Consolidated Invoice Match":
      return 0
    case "GSTIN Mismatch Match":
    case "Amount-Led Match":
    case "Probable Month Match":
    case "Unclaimed ITC":
    case "ITC Eligibility Uncertain":
    case "Partially Booked ITC":
    case "ITC Reduced by Supplier":
      return Math.abs(diffs.igst) + Math.abs(diffs.cgst) + Math.abs(diffs.sgst)
    case "Debit Note Misclassified":
      return b2b ? b2b.igst + b2b.cgst + b2b.sgst : 0
    case "Non-GST Entry":
      return 0
    default:
      return 0
  }
}

export function isReconciliationIssueRow(r: ReconciliationRow): boolean {
  if (r.status === "Non-GST Entry") return false
  return r.itcRisk !== "Safe" && r.status !== "QRMP Delay"
}

export function isSafeMatchedRow(r: ReconciliationRow): boolean {
  return (
    r.status === "Matched" &&
    r.itcRisk === "Safe" &&
    r.isPOSMismatch !== true &&
    r.isDeadlineExpired !== true
  )
}

/** Per-row ITC at risk after status and ITC risk are final (incl. QRMP override). */
export function computeRowTotalITCAtRisk(r: ReconciliationRow): number {
  const sum2B = (r.igst2B ?? 0) + (r.cgst2B ?? 0) + (r.sgst2B ?? 0)
  const sumPR = (r.igstPR ?? 0) + (r.cgstPR ?? 0) + (r.sgstPR ?? 0)
  if (r.status === "QRMP Delay") return 0
  if (r.status === "Matched" && r.itcRisk === "Safe" && r.isPOSMismatch !== true && !r.isDeadlineExpired) {
    return 0
  }
  if (r.status === "Sec 16(4) Expired") return sum2B
  if (r.status === "ITC Blocked" || r.itcAvailable === "N") return sum2B
  if (r.status === "ITC Temporary") return sum2B
  if (r.status === "Suggested Match") {
    const td =
      Math.abs(r.igstDiff ?? 0) + Math.abs(r.cgstDiff ?? 0) + Math.abs(r.sgstDiff ?? 0)
    return td <= 1 ? 0 : td
  }
  if (r.status === "Value Mismatch") {
    return Math.abs(r.igstDiff ?? 0) + Math.abs(r.cgstDiff ?? 0) + Math.abs(r.sgstDiff ?? 0)
  }
  if (r.status === "CESS Mismatch") return Math.abs(r.cessDiff ?? 0)
  if (r.status === "Tax Rate Mismatch") {
    return (
      Math.abs(r.igstDiff ?? 0) + Math.abs(r.cgstDiff ?? 0) + Math.abs(r.sgstDiff ?? 0)
    )
  }
  if (r.status === "POS Mismatch") return sum2B
  if (r.status === "In PR Only" || r.status === "Period Timing Mismatch") return sumPR
  if (r.status === "In 2B Only") return sum2B
  if (
    r.status === "Date Gap Match" ||
    r.status === "Group Entity Match" ||
    r.status === "Consolidated Invoice Match"
  ) {
    return 0
  }
  if (
    r.status === "GSTIN Mismatch Match" ||
    r.status === "Amount-Led Match" ||
    r.status === "Probable Month Match" ||
    r.status === "Unclaimed ITC" ||
    r.status === "ITC Eligibility Uncertain" ||
    r.status === "Partially Booked ITC" ||
    r.status === "ITC Reduced by Supplier"
  ) {
    return (
      Math.abs(r.igstDiff ?? 0) + Math.abs(r.cgstDiff ?? 0) + Math.abs(r.sgstDiff ?? 0)
    )
  }
  if (r.status === "Debit Note Misclassified") return sum2B
  if (r.status === "Non-GST Entry") return 0
  return sum2B
}

export function buildReconciliationSummary(results: ReconciliationRow[]): ReconciliationSummary {
  const issueRows = results.filter(isReconciliationIssueRow)
  const issuesITC = issueRows.reduce((s, r) => s + (r.totalITCAtRisk ?? 0), 0)
  const safeMatched = results.filter(isSafeMatchedRow)
  const prOnlyRows = results.filter((r) => r.status === "In PR Only")
  if (process.env.NODE_ENV !== "production" && prOnlyRows.length > 0) {
    // eslint-disable-next-line no-console -- verify Missing card PR-only count in development
    console.log(
      "PR Only rows:",
      prOnlyRows.map((r) => r.invoiceNumber),
    )
  }
  const totalCESSAtRisk = results.reduce((s, r) => s + Math.abs(r.cessDiff ?? 0), 0)
  return {
    totalInvoices: results.length,
    matchedCount: safeMatched.length,
    valueMismatchCount: results.filter((r) => r.status === "Value Mismatch").length,
    in2BOnlyCount: results.filter((r) => r.status === "In 2B Only").length,
    inPROnlyCount: prOnlyRows.length,
    qrmpCount: results.filter((r) => r.status === "QRMP Delay").length,
    issuesFoundCount: issueRows.length,
    totalITCAtRisk: issuesITC,
    totalITCSafe: safeMatched.reduce(
      (s, r) => s + (r.igst2B ?? 0) + (r.cgst2B ?? 0) + (r.sgst2B ?? 0),
      0,
    ),
    taxTypeMismatchCount: results.filter((r) => r.status === "Tax Type Mismatch").length,
    suggestedMatchCount: results.filter((r) => r.status === "Suggested Match").length,
    duplicateCount: results.filter((r) => r.status === "Duplicate").length,
    rcmInvoiceCount: results.filter((r) => r.status === "RCM Invoice").length,
    deadlineExpiredCount: results.filter((r) => r.isDeadlineExpired).length,
    deadlineWarningCount: results.filter((r) => r.isDeadlineWarning && !r.isDeadlineExpired).length,
    posMismatchCount: results.filter((r) => r.isPOSMismatch).length,
    totalCESSAtRisk,
    b2baCount: results.filter((r) => r.documentType === "B2BA").length,
    cdnrCount: results.filter((r) => r.documentType === "CDNR").length,
    cdnrDNCount: results.filter((r) => r.documentType === "CDNR-DN").length,
  }
}

function determineBaseRisk(
  status: MismatchStatus,
  itcAvailable: ITCStatus | null,
  totalITCAtRisk: number,
): ITCRiskLevel {
  void totalITCAtRisk
  if (status === "Sec 16(4) Expired") return "Critical"
  if (status === "ITC Blocked" || itcAvailable === "N") return "Critical"
  if (status === "ITC Temporary") return "Medium"
  if (status === "Date Gap Match" || status === "Group Entity Match") return "Low"
  if (
    status === "GSTIN Mismatch Match" ||
    status === "Amount-Led Match" ||
    status === "Consolidated Invoice Match" ||
    status === "Probable Month Match" ||
    status === "Unclaimed ITC" ||
    status === "ITC Eligibility Uncertain" ||
    status === "Partially Booked ITC" ||
    status === "ITC Reduced by Supplier"
  ) {
    return "Medium"
  }
  if (status === "Debit Note Misclassified") return "Critical"
  if (status === "Non-GST Entry") return "None"
  if (status === "POS Mismatch" || status === "Tax Rate Mismatch") return "Medium"
  if (status === "CESS Mismatch") return "Low"
  if (status === "QRMP Delay") return "Low"
  if (status === "Period Timing Mismatch") return "Medium"
  if (status === "In PR Only") return "High"
  if (status === "In 2B Only") return "High"
  if (status === "Value Mismatch") return "Medium"
  if (status === "Tax Type Mismatch") return "Medium"
  if (status === "Suggested Match") return "Medium"
  if (status === "RCM Invoice") return "Medium"
  if (status === "Duplicate") return "Critical"
  if (itcAvailable === "T") return "Medium"
  if (status === "Matched" && itcAvailable === "Y") return "Safe"
  return "Medium"
}

function generateBaseAction(
  status: MismatchStatus,
  itcAvailable: ITCStatus | null,
  supplierGSTIN: string,
  invoiceNumber: string,
  totalITCAtRisk: number,
  taxableDiff: number | null,
  itcBlockReason: ITCBlockReason,
  b2b: GSTR2BRow | undefined,
  pr?: PurchaseRegisterRow | undefined,
): { action: string; urgency: ActionUrgency } {
  const itcStr = formatINR(totalITCAtRisk)
  const gstin = supplierGSTIN
  const inv = invoiceNumber

  if (status === "Sec 16(4) Expired") {
    return {
      action: `Section 16(4) ITC claim deadline has expired for Invoice ${inv}. This ITC (${itcStr}) can no longer be claimed in returns — validate with your CA before any reversal entries.`,
      urgency: "Immediate",
    }
  }

  if (itcAvailable === "N" && b2b) {
    const rsn = extractItcBlockCode(b2b.itcUnavailableReason)
    if (rsn === "P" || itcBlockReason === "permanent") {
      return {
        action:
          `ITC PERMANENTLY BLOCKED under Section 17(5). Invoice ${inv} from ${gstin} contains goods or services where ITC is not allowed. Do NOT claim ${itcStr} ITC under any circumstances.`,
        urgency: "Immediate",
      }
    }
    if (rsn === "C" || itcBlockReason === "conditional") {
      return {
        action:
          `ITC is conditionally blocked for Invoice ${inv}. Certain GST conditions are not met. Review with your CA before claiming ${itcStr} ITC.`,
        urgency: "Before Filing",
      }
    }
    return {
      action:
        `ITC blocked by GSTR-2B for Invoice ${inv}. Do NOT claim ${itcStr}. Verify reason with supplier ${gstin} — check Section 17(5) or Place of Supply mismatch.`,
      urgency: "Immediate",
    }
  }

  if (status === "Duplicate") {
    const src = b2b ? "GSTR-2B" : "Purchase Register"
    const amt = formatINR(totalITCAtRisk)
    return {
      action: `DUPLICATE INVOICE detected. Invoice ${inv} from ${gstin} appears more than once in ${src}. Remove the duplicate to avoid double-claiming ITC of ${amt}. This can attract DRC-01C notice.`,
      urgency: "Immediate",
    }
  }

  if (status === "RCM Invoice" && b2b) {
    return {
      action: `This is a Reverse Charge (RCM) invoice. ITC is NOT available through GSTR-2B for RCM supplies. Pay GST directly and claim ITC in GSTR-3B Table 4D. Taxable value: ${formatINR(b2b.taxableValue)}, Tax: ${formatINR(b2b.igst + b2b.cgst + b2b.sgst)}.`,
      urgency: "Before Filing",
    }
  }

  if (status === "Suggested Match") {
    return {
      action: `Possible same invoice after normalising invoice numbers. Verify amounts before claiming ${itcStr} ITC.`,
      urgency: "Monitor",
    }
  }

  if (status === "QRMP Delay") {
    const invDate = (pr?.invoiceDate ?? b2b?.invoiceDate ?? "").trim()
    const expected = qrmpExpectedGstr2BMonthLabel(invDate || (b2b?.invoiceDate ?? ""))
    return {
      action: `Supplier ${gstin} appears to file under the QRMP scheme (quarterly filing). This invoice is expected to appear in ${expected}'s GSTR-2B. No action needed — monitor next month.`,
      urgency: "Monitor",
    }
  }

  if (status === "Tax Type Mismatch" && b2b && pr) {
    const tot = formatINR(b2b.igst + b2b.cgst + b2b.sgst)
    return {
      action: `Total tax is same (${tot}) but tax components differ. GSTR-2B shows IGST ${formatINR(b2b.igst)}, CGST ${formatINR(b2b.cgst)}, SGST ${formatINR(b2b.sgst)} while books show IGST ${formatINR(pr.igst)}, CGST ${formatINR(pr.cgst)}, SGST ${formatINR(pr.sgst)}. Interstate vs intrastate classification error. Contact supplier ${gstin} to verify Place of Supply and amend GSTR-1 if needed. Do not claim until resolved — wrong classification can attract scrutiny.`,
      urgency: "Before Filing",
    }
  }

  if (status === "POS Mismatch" && b2b) {
    return {
      action: `Place of Supply / tax component mismatch for Invoice ${inv}. GSTR-2B does not align with interstate vs intrastate treatment. Do NOT claim ${itcStr} until resolved with supplier ${gstin}.`,
      urgency: "Before Filing",
    }
  }

  if (status === "CESS Mismatch" && b2b && pr) {
    return {
      action: `CESS differs between GSTR-2B and books for Invoice ${inv}. Reconcile before claiming.`,
      urgency: "Monitor",
    }
  }

  if (status === "Tax Rate Mismatch") {
    return {
      action: `Tax rate % differs between GSTR-2B and Purchase Register for Invoice ${inv}. Verify HSN and rate mapping before claiming ${itcStr}.`,
      urgency: "Before Filing",
    }
  }

  if (status === "In PR Only") {
    return {
      action: `Supplier ${gstin} has NOT filed GSTR-1. Invoice ${inv} is missing from GSTR-2B. Do NOT claim ${itcStr} ITC until supplier files. Send follow-up requesting GSTR-1 filing.`,
      urgency: "Immediate",
    }
  }

  if (status === "Period Timing Mismatch") {
    return {
      action: `Invoice ${inv} falls 1–2 months before this GSTR-2B period and is not yet reflected — supplier may file late. Check next month's GSTR-2B before treating as a definitive missing invoice.`,
      urgency: "Monitor",
    }
  }

  if (status === "In 2B Only") {
    return {
      action: `Invoice ${inv} from ${gstin} is in GSTR-2B but NOT in your Purchase Register. Verify purchase; if genuine, add to books and claim ${itcStr} ITC.`,
      urgency: "Before Filing",
    }
  }

  if (status === "Value Mismatch") {
    const diff = taxableDiff !== null ? formatINR(Math.abs(taxableDiff)) : ""
    return {
      action: `Taxable value differs by ${diff} for Invoice ${inv}. Claim only the lower amount to avoid DRC-01C. Request supplier ${gstin} to amend GSTR-1.`,
      urgency: "Before Filing",
    }
  }

  if (status === "Date Gap Match") {
    return {
      action:
        "Invoice dates differ significantly between books and portal. Confirm correct period for ITC claim.",
      urgency: "Monitor",
    }
  }

  if (status === "Non-GST Entry") {
    return {
      action: "No GSTIN and zero tax. Excluded from GST reconciliation scope.",
      urgency: "None",
    }
  }

  if (status === "ITC Reduced by Supplier") {
    return {
      action:
        "Supplier has filed a lower ITC amount on the portal than what your books show. Maximum claimable ITC is the portal amount. Adjust your books accordingly.",
      urgency: "Before Filing",
    }
  }

  if (itcAvailable === "T") {
    return {
      action: `ITC for Invoice ${inv} is temporarily unavailable in GSTR-2B. Monitor next month's GSTR-2B. Do NOT claim yet.`,
      urgency: "Monitor",
    }
  }

  return {
    action: `Invoice ${inv} is fully matched. Safe to claim ${itcStr} ITC in GSTR-3B filing.`,
    urgency: "None",
  }
}

const P2_TOL_INR = 10
const MAX_CONSOLIDATED_SUBSET = 5

function sumGstLines(r: { igst: number; cgst: number; sgst: number }): number {
  return r.igst + r.cgst + r.sgst
}

function isNonGstPrRow(pr: PurchaseRegisterRow): boolean {
  if ((pr.supplierGSTIN ?? "").trim() !== "") return false
  const t = sumGstLines({
    igst: pr.igst ?? 0,
    cgst: pr.cgst ?? 0,
    sgst: pr.sgst ?? 0,
  })
  const c = pr.cess ?? 0
  return t === 0 && c === 0
}

function panFromGstin(gstin: string): string {
  const g = gstin.trim().toUpperCase()
  if (g.length < 12) return ""
  return g.substring(2, 12)
}

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const [head, ...tail] = arr
  const withHead = combinations(tail, k - 1).map((c) => [head!, ...c])
  const withoutHead = combinations(tail, k)
  return [...withHead, ...withoutHead]
}

function subsetsBetweenSizes<T>(items: T[], minK: number, maxK: number): T[][] {
  const out: T[][] = []
  for (let k = minK; k <= Math.min(maxK, items.length); k++) {
    out.push(...combinations(items, k))
  }
  return out
}

function isMatchLikeStatus(s: MismatchStatus): boolean {
  switch (s) {
    case "Matched":
    case "Suggested Match":
    case "Date Gap Match":
    case "Group Entity Match":
    case "GSTIN Mismatch Match":
    case "Amount-Led Match":
    case "Consolidated Invoice Match":
    case "Probable Month Match":
      return true
    default:
      return false
  }
}

function pushPairRow(
  results: ReconciliationRow[],
  b2b: GSTR2BRow,
  pr: PurchaseRegisterRow,
  matchKey: string,
  status: MismatchStatus,
  itcRisk: ITCRiskLevel,
  recommendedAction: string,
  actionUrgency: ActionUrgency,
  tolerance: number,
): void {
  const diffs = {
    taxable: b2b.taxableValue - pr.taxableValue,
    igst: b2b.igst - pr.igst,
    cgst: b2b.cgst - pr.cgst,
    sgst: b2b.sgst - pr.sgst,
  }
  const extras = defaultRowFields()
  const tr2n = normalizeGstRatePercent(b2b.taxRate)
  extras.taxRate2B = tr2n ?? b2b.taxRate
  const trpInf = inferTaxRatePR(pr)
  extras.taxRatePR =
    pr.taxRate !== undefined && Number.isFinite(pr.taxRate) && pr.taxRate > 0
      ? normalizeGstRatePercent(pr.taxRate) ?? trpInf
      : trpInf
  const cDiff = (b2b.cess ?? 0) - (pr.cess ?? 0)
  extras.cessDiff = cDiff
  const totalITCAtRisk = calcITCAtRisk(status, b2b, pr, {
    igst: diffs.igst,
    cgst: diffs.cgst,
    sgst: diffs.sgst,
  })
  results.push({
    supplierGSTIN: pr.supplierGSTIN,
    supplierName: b2b.supplierName || pr.supplierName,
    invoiceNumber: pr.invoiceNumber,
    documentType: b2b.documentType ?? "B2B",
    rawInvoiceNumber2B: b2b.rawInvoiceNumber ?? b2b.invoiceNumber,
    rawInvoiceNumberPR: pr.rawInvoiceNumber ?? pr.invoiceNumber,
    normalisedInvoiceNumber2B: normaliseInvoiceNumber(b2b.invoiceNumber),
    normalisedInvoiceNumberPR: normaliseInvoiceNumber(pr.invoiceNumber),
    invoiceDate: b2b.invoiceDate || pr.invoiceDate,
    placeOfSupply: b2b.placeOfSupply || pr.placeOfSupply || "",
    matchKey,
    status,
    itcRisk,
    itcAvailable: b2b.itcAvailable,
    reverseCharge: b2b.reverseCharge,
    taxable2B: b2b.taxableValue,
    igst2B: b2b.igst,
    cgst2B: b2b.cgst,
    sgst2B: b2b.sgst,
    taxablePR: pr.taxableValue,
    igstPR: pr.igst,
    cgstPR: pr.cgst,
    sgstPR: pr.sgst,
    taxableDiff: diffs.taxable,
    igstDiff: diffs.igst,
    cgstDiff: diffs.cgst,
    sgstDiff: diffs.sgst,
    totalITCAtRisk,
    recommendedAction,
    actionUrgency,
    riskSortOrder: getRiskSortOrder(itcRisk),
    ...extras,
  })
}

/** P-2: same GSTIN, same calendar month (2B invoice date vs PR), GST within ₹10, different invoice # — runs after M-4/M-5/M-6, before In PR Only. */
function runProbableMonthMatchPass(
  gstr2bMain: GSTR2BRow[],
  prMain: PurchaseRegisterRow[],
  consumedB2B: Set<string>,
  consumedPR: Set<string>,
  tolerance: number,
  results: ReconciliationRow[],
): void {
  const probableMonth =
    "Same supplier, same month, matching GST amount but different invoice number. Could be coincidence. Review carefully before claiming ITC."

  for (const pr of prMain) {
    const pk = reconcileMatchKey(pr.supplierGSTIN, pr.invoiceNumber)
    if (consumedPR.has(pk)) continue
    const g = pr.supplierGSTIN.trim()
    const dp = parseInvoiceDateFlexible(pr.invoiceDate)
    if (!dp) continue
    const tp = sumGstLines(pr)
    for (const b2b of gstr2bMain) {
      const bk = reconcileMatchKey(b2b.supplierGSTIN, b2b.invoiceNumber)
      if (consumedB2B.has(bk)) continue
      if (b2b.supplierGSTIN.trim() !== g) continue
      if (normaliseInvoiceNumber(b2b.invoiceNumber) === normaliseInvoiceNumber(pr.invoiceNumber)) continue
      const db = parseInvoiceDateFlexible(getB2bInvoiceDateForMatching(b2b))
      if (!db) continue
      if (db.getMonth() !== dp.getMonth() || db.getFullYear() !== dp.getFullYear()) continue
      const t2 = sumGstLines(b2b)
      if (Math.abs(t2 - tp) > P2_TOL_INR) continue
      consumedB2B.add(bk)
      consumedPR.add(pk)
      pushPairRow(
        results,
        b2b,
        pr,
        pk,
        "Probable Month Match",
        "Medium",
        probableMonth,
        "Before Filing",
        tolerance,
      )
      break
    }
  }
}

function runCrossGstinMatchingPasses(
  gstr2bMain: GSTR2BRow[],
  prMain: PurchaseRegisterRow[],
  consumedB2B: Set<string>,
  consumedPR: Set<string>,
  tolerance: number,
  results: ReconciliationRow[],
): void {
  const actions = {
    groupEntity:
      "Same PAN detected under a different state GSTIN. Confirm this is a group entity supply and verify Place of Supply.",
    gstinMismatch:
      "Invoice matched by number and amount but supplier GSTINs differ completely. Verify correct GSTIN before claiming ITC.",
    amountLed:
      "GST amounts match but invoice numbers differ. Likely the same invoice with a formatting difference. Verify before claiming ITC.",
    consolidated:
      "Single book entry matches multiple portal invoices from the same supplier. Confirm all invoices are accounted for before claiming ITC.",
  }

  // M-4-PAN
  for (const pr of prMain) {
    const pk = reconcileMatchKey(pr.supplierGSTIN, pr.invoiceNumber)
    if (consumedPR.has(pk)) continue
    const nInv = normaliseInvoiceNumber(pr.invoiceNumber)
    for (const b2b of gstr2bMain) {
      const bk = reconcileMatchKey(b2b.supplierGSTIN, b2b.invoiceNumber)
      if (consumedB2B.has(bk)) continue
      if (normaliseInvoiceNumber(b2b.invoiceNumber) !== nInv) continue
      if (b2b.supplierGSTIN.trim() === pr.supplierGSTIN.trim()) continue
      const panB = panFromGstin(b2b.supplierGSTIN)
      const panP = panFromGstin(pr.supplierGSTIN)
      if (!panB || panB !== panP) continue
      consumedB2B.add(bk)
      consumedPR.add(pk)
      pushPairRow(
        results,
        b2b,
        pr,
        pk,
        "Group Entity Match",
        "Low",
        actions.groupEntity,
        "Monitor",
        tolerance,
      )
      break
    }
  }

  // M-4 GSTIN Mismatch Match
  for (const pr of prMain) {
    const pk = reconcileMatchKey(pr.supplierGSTIN, pr.invoiceNumber)
    if (consumedPR.has(pk)) continue
    const nInv = normaliseInvoiceNumber(pr.invoiceNumber)
    for (const b2b of gstr2bMain) {
      const bk = reconcileMatchKey(b2b.supplierGSTIN, b2b.invoiceNumber)
      if (consumedB2B.has(bk)) continue
      if (normaliseInvoiceNumber(b2b.invoiceNumber) !== nInv) continue
      if (b2b.supplierGSTIN.trim() === pr.supplierGSTIN.trim()) continue
      const panB = panFromGstin(b2b.supplierGSTIN)
      const panP = panFromGstin(pr.supplierGSTIN)
      if (panB && panP && panB === panP) continue
      const t2 = sumGstLines(b2b)
      const tp = sumGstLines(pr)
      if (Math.abs(t2 - tp) > tolerance) continue
      consumedB2B.add(bk)
      consumedPR.add(pk)
      pushPairRow(
        results,
        b2b,
        pr,
        pk,
        "GSTIN Mismatch Match",
        "Medium",
        actions.gstinMismatch,
        "Before Filing",
        tolerance,
      )
      break
    }
  }

  // M-5 Amount-Led Match
  for (const pr of prMain) {
    const pk = reconcileMatchKey(pr.supplierGSTIN, pr.invoiceNumber)
    if (consumedPR.has(pk)) continue
    const tp = sumGstLines(pr)
    const g = pr.supplierGSTIN.trim()
    for (const b2b of gstr2bMain) {
      const bk = reconcileMatchKey(b2b.supplierGSTIN, b2b.invoiceNumber)
      if (consumedB2B.has(bk)) continue
      if (b2b.supplierGSTIN.trim() !== g) continue
      if (normaliseInvoiceNumber(b2b.invoiceNumber) === normaliseInvoiceNumber(pr.invoiceNumber)) continue
      if (!invoiceNumbersLookLikeFormattingVariant(b2b.invoiceNumber, pr.invoiceNumber)) continue
      const t2 = sumGstLines(b2b)
      if (Math.abs(t2 - tp) > tolerance) continue
      consumedB2B.add(bk)
      consumedPR.add(pk)
      pushPairRow(
        results,
        b2b,
        pr,
        pk,
        "Amount-Led Match",
        "Medium",
        actions.amountLed,
        "Before Filing",
        tolerance,
      )
      break
    }
  }

  // M-6 Consolidated Invoice Match
  const byGstin = new Map<string, GSTR2BRow[]>()
  for (const b2b of gstr2bMain) {
    const bk = reconcileMatchKey(b2b.supplierGSTIN, b2b.invoiceNumber)
    if (consumedB2B.has(bk)) continue
    const g = b2b.supplierGSTIN.trim()
    if (!byGstin.has(g)) byGstin.set(g, [])
    byGstin.get(g)!.push(b2b)
  }

  for (const pr of prMain) {
    const pk = reconcileMatchKey(pr.supplierGSTIN, pr.invoiceNumber)
    if (consumedPR.has(pk)) continue
    const g = pr.supplierGSTIN.trim()
    const list = byGstin.get(g)
    if (!list || list.length < 2) continue
    const tp = sumGstLines(pr)
    const available = list.filter((b) => !consumedB2B.has(reconcileMatchKey(b.supplierGSTIN, b.invoiceNumber)))
    if (available.length < 2) continue
    const indexed = available.map((b, i) => ({ b, i }))
    let found: GSTR2BRow[] | null = null
    for (const subset of subsetsBetweenSizes(indexed, 2, MAX_CONSOLIDATED_SUBSET)) {
      const sum = subset.reduce((s, x) => s + sumGstLines(x.b), 0)
      if (Math.abs(sum - tp) <= tolerance) {
        found = subset.map((x) => x.b)
        break
      }
    }
    if (!found) continue
    consumedPR.add(pk)
    for (const b2b of found) {
      consumedB2B.add(reconcileMatchKey(b2b.supplierGSTIN, b2b.invoiceNumber))
    }
    for (const b2b of found) {
      pushPairRow(
        results,
        b2b,
        pr,
        pk,
        "Consolidated Invoice Match",
        "Medium",
        actions.consolidated,
        "Before Filing",
        tolerance,
      )
    }
  }
}

function resolveB2BForQuery(row: ReconciliationRow, map2B: Map<string, GSTR2BRow>): GSTR2BRow | undefined {
  const direct = map2B.get(row.matchKey)
  if (direct) return direct
  const fuzzyGstin = resolveB2BForRow(row, map2B)
  if (fuzzyGstin) return fuzzyGstin
  const t2 = (row.igst2B ?? 0) + (row.cgst2B ?? 0) + (row.sgst2B ?? 0)
  const nInv = normaliseInvoiceNumber(row.invoiceNumber)
  for (const b of map2B.values()) {
    if (normaliseInvoiceNumber(b.invoiceNumber) !== nInv) continue
    if (Math.abs(sumGstLines(b) - t2) <= 1) return b
  }
  return undefined
}

/** Phase 7 — POS mismatch absolute last; only on plain Matched pairs (never steal Date Gap, Suggested, Consolidated, etc.). */
function applyPOSMismatchPhase(
  results: ReconciliationRow[],
  map2B: Map<string, GSTR2BRow>,
  mapPR: Map<string, PurchaseRegisterRow>,
  tolerance: number,
): void {
  for (const row of results) {
    // Equivalent to "only if no other outcome yet" in deferred-status engines: we only flag POS on Matched.
    if (row.status !== "Matched") continue
    if (row.isDeadlineExpired) continue
    if (row.isQRMP) continue
    if (row.itcAvailable === "N" || row.itcAvailable === "T") continue
    const b2b = map2B.get(row.matchKey) ?? resolveB2BForRow(row, map2B)
    const pr = mapPR.get(row.matchKey)
    if (!b2b || !pr) continue
    const bookedItc = getPrBookedItcAmount(pr)
    const sumPrGst = sumGstLines(pr)
    const sumB2bGst = sumGstLines(b2b)
    if (
      b2b.itcAvailable === "Y" &&
      bookedItc !== null &&
      bookedItc <= 0.01 &&
      Math.abs(sumPrGst - sumB2bGst) <= tolerance
    ) {
      continue
    }
    if (!shouldFlagPOSMismatch(b2b)) continue

    const diffs = {
      taxable: b2b.taxableValue - pr.taxableValue,
      igst: b2b.igst - pr.igst,
      cgst: b2b.cgst - pr.cgst,
      sgst: b2b.sgst - pr.sgst,
    }
    row.status = "POS Mismatch"
    row.isPOSMismatch = true
    row.posWarning =
      "Place of supply vs tax component pattern inconsistent with interstate/intrastate supply."
    row.totalITCAtRisk = calcITCAtRisk("POS Mismatch", b2b, pr, {
      igst: diffs.igst,
      cgst: diffs.cgst,
      sgst: diffs.sgst,
    })
    row.itcRisk = determineBaseRisk("POS Mismatch", b2b.itcAvailable, row.totalITCAtRisk)
    const gen = generateBaseAction(
      "POS Mismatch",
      b2b.itcAvailable,
      row.supplierGSTIN,
      row.invoiceNumber,
      row.totalITCAtRisk,
      diffs.taxable,
      row.itcBlockReason ?? null,
      b2b,
      pr,
    )
    row.recommendedAction = gen.action
    row.actionUrgency = gen.urgency
  }
}

function applyPostMatchQueryChecks(
  results: ReconciliationRow[],
  map2B: Map<string, GSTR2BRow>,
  mapPR: Map<string, PurchaseRegisterRow>,
  tolerance: number,
): void {
  const q9Prefixes = ["9963", "9964", "9972", "8703"]
  const q9Keywords = ["food", "beverage", "club", "membership", "personal", "accommodation"]

  for (const row of results) {
    const b2b = resolveB2BForQuery(row, map2B)
    const pr = mapPR.get(row.matchKey)
    if (!b2b || !pr) continue

    const allowDebitNote =
      isMatchLikeStatus(row.status) || row.status === "Value Mismatch"
    if (allowDebitNote) {
      const sumB2bGst = sumGstLines(b2b)
      const sumPrGst = sumGstLines(pr)
      const valB = b2b.invoiceValue ?? b2b.taxableValue
      const valP = pr.totalInvoiceValue ?? pr.taxableValue
      const signConflict =
        valB !== 0 &&
        valP !== 0 &&
        Math.sign(valB) !== Math.sign(valP)
      const gstr2bPositive = valB > 0 || sumB2bGst > tolerance
      const prNegative = valP < 0 || sumPrGst < -tolerance
      const prNegComponent = pr.igst < 0 || pr.cgst < 0 || pr.sgst < 0
      const typ = ((b2b as { invoiceType?: string }).invoiceType ?? "").toUpperCase()
      const b2bCdnr = typ.includes("CDN") || typ.includes("CNDR")
      const prPositive = valP > 0
      if (
        prNegComponent ||
        (gstr2bPositive && prNegative) ||
        signConflict ||
        (b2bCdnr && prPositive)
      ) {
        row.status = "Debit Note Misclassified"
        row.itcRisk = "Critical"
        row.recommendedAction =
          "Document type conflict — portal and books disagree on whether this is a debit or credit note. Immediate correction required to avoid incorrect ITC claim or reversal."
        row.actionUrgency = "Immediate"
        continue
      }
    }

    const allowPriorityValue =
      isMatchLikeStatus(row.status) || row.status === "Value Mismatch"
    if (!allowPriorityValue) continue

    const sum2b = sumGstLines({
      igst: row.igst2B ?? b2b.igst,
      cgst: row.cgst2B ?? b2b.cgst,
      sgst: row.sgst2B ?? b2b.sgst,
    })
    const sumPr = sumGstLines({
      igst: row.igstPR ?? pr.igst,
      cgst: row.cgstPR ?? pr.cgst,
      sgst: row.sgstPR ?? pr.sgst,
    })

    if (row.status !== "Consolidated Invoice Match" && b2b.itcAvailable === "Y" && sum2b + 1 < sumPr) {
      row.status = "ITC Reduced by Supplier"
      row.itcRisk = "Medium"
      row.recommendedAction =
        "Supplier has filed a lower ITC amount on the portal than what your books show. Maximum claimable ITC is the portal amount. Adjust your books accordingly."
      row.actionUrgency = "Before Filing"
      continue
    }

    const taxableMatch = Math.abs(b2b.taxableValue - pr.taxableValue) <= tolerance
    if (
      row.status !== "Consolidated Invoice Match" &&
      taxableMatch &&
      !taxRatesDisagree(b2b, pr) &&
      partialBookingTaxPatternHolds(b2b, pr, tolerance) &&
      sumPr > tolerance &&
      sum2b > sumPr + tolerance &&
      sumPr < sum2b * 0.9 &&
      sum2b - sumPr > tolerance
    ) {
      row.status = "Partially Booked ITC"
      row.itcRisk = "Medium"
      row.recommendedAction =
        "ITC in books is significantly lower than the portal amount. Appears to be partially booked. Verify if the remaining credit is yet to be claimed."
      row.actionUrgency = "Before Filing"
      continue
    }

    const bookedItc = getPrBookedItcAmount(pr)
    const treatAsZeroBooked =
      bookedItc !== null ? bookedItc <= 0.01 : sumPr <= 0.01
    if (b2b.itcAvailable === "Y" && treatAsZeroBooked) {
      row.status = "Unclaimed ITC"
      row.itcRisk = "Medium"
      row.recommendedAction =
        "Eligible ITC exists in GSTR-2B but not booked in your Purchase Register. Book the credit before the Section 16(4) deadline to avoid permanent loss."
      row.actionUrgency = "Before Filing"
      continue
    }

    if (b2b.itcAvailable === "Y") {
      const hsn = (pr.hsnCode ?? "").trim()
      const prefixHit = q9Prefixes.some((p) => hsn.startsWith(p))
      const blob =
        `${pr.supplierName ?? ""} ${b2b.supplierName ?? ""}`.toLowerCase()
      const keywordHit = q9Keywords.some((k) => blob.includes(k))
      if (prefixHit || keywordHit) {
        row.status = "ITC Eligibility Uncertain"
        row.itcRisk = "Medium"
        row.recommendedAction =
          "This invoice may involve mixed-use or restricted goods/services. Confirm ITC eligibility under Section 17(5) before claiming."
        row.actionUrgency = "Before Filing"
      }
    }
  }

  for (const row of results) {
    if (row.status !== "Value Mismatch") continue
    const b2b = resolveB2BForQuery(row, map2B)
    const pr = mapPR.get(row.matchKey)
    if (!b2b || !pr) continue
    const sum2b = sumGstLines({
      igst: row.igst2B ?? b2b.igst,
      cgst: row.cgst2B ?? b2b.cgst,
      sgst: row.sgst2B ?? b2b.sgst,
    })
    const sumPr = sumGstLines({
      igst: row.igstPR ?? pr.igst,
      cgst: row.cgstPR ?? pr.cgst,
      sgst: row.sgstPR ?? pr.sgst,
    })
    if (b2b.itcAvailable !== "Y" || sumPr > 0.01 || sum2b <= 0.01) continue
    row.status = "Unclaimed ITC"
    row.itcRisk = "Medium"
    row.recommendedAction =
      "Eligible ITC exists in GSTR-2B but not booked in your Purchase Register. Book the credit before the Section 16(4) deadline to avoid permanent loss."
    row.actionUrgency = "Before Filing"
  }
}

function computeListSortOrder(row: ReconciliationRow): number {
  let tier = 50
  if (row.status === "Non-GST Entry") tier = 95
  else if (row.status === "Duplicate" || row.isDuplicate) tier = 1
  else if (row.isDeadlineExpired) tier = 2
  else if (row.itcAvailable === "N") tier = 3
  else if (row.isDeadlineWarning && !row.isDeadlineExpired) tier = 4
  else if (row.status === "In PR Only" && !row.isTimingMismatch) tier = 5
  else if (row.status === "In 2B Only") tier = 6
  else if (row.status === "Tax Type Mismatch") tier = 7
  else if (row.status === "Value Mismatch") tier = 8
  else if (row.status === "Suggested Match") tier = 9
  else if (row.status === "RCM Invoice") tier = 10
  else if (row.isPOSMismatch) tier = 11
  else if (row.status === "Period Timing Mismatch" || (row.status === "In PR Only" && row.isTimingMismatch))
    tier = 12
  else if (row.status === "QRMP Delay") tier = 13
  else if (row.status === "Matched") tier = 14
  else tier = getStatusSortPriority(row.status)
  const riskBoost = (1000 - Math.min(row.totalITCAtRisk, 999)) / 1_000_000
  return tier * 1_000_000 - row.totalITCAtRisk + riskBoost
}

export async function reconcileB2B(
  gstr2bRows: GSTR2BRow[],
  purchaseRows: PurchaseRegisterRow[],
  config?: AppConfig,
  recipientGSTIN?: string,
  reconciliationPeriod?: { month: number; year: number },
): Promise<{ rows: ReconciliationRow[]; summary: ReconciliationSummary }> {
  const tolerance = config?.itcMatchToleranceInr ?? 1
  /** Never default month/year to 0 — missing period skips QRMP via `recMonth == null`. */
  const reconPeriod = normalizeReconciliationPeriod(reconciliationPeriod)
  const recMonth = reconPeriod?.month
  const recYear = reconPeriod?.year

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console -- QRMP: verify period passed from hook
    console.log("reconcileB2B called with:", {
      gstr2bCount: gstr2bRows.length,
      reconciliationMonth: recMonth,
      reconciliationYear: recYear,
      reconciliationPeriodRaw: reconciliationPeriod,
      hasReconciliationPeriod: recMonth != null && recYear != null,
    })
  }

  const results: ReconciliationRow[] = []

  if (process.env.NODE_ENV !== "production" && gstr2bRows.length > 0) {
    const sampleRow = gstr2bRows[gstr2bRows.length - 1]!
    // eslint-disable-next-line no-console -- QRMP / supprd column mapping (Kerala Tiles)
    console.log("=== QRMP DEBUG ===")
    // eslint-disable-next-line no-console -- QRMP / supprd column mapping (Kerala Tiles)
    console.log("All field names:", Object.keys(sampleRow))
    // eslint-disable-next-line no-console -- QRMP / supprd column mapping (Kerala Tiles)
    console.log("supplierFilingPeriod:", sampleRow.supplierFilingPeriod)
    // eslint-disable-next-line no-console -- QRMP / supprd column mapping (Kerala Tiles)
    console.log("raw row:", JSON.stringify(sampleRow))
    // eslint-disable-next-line no-console -- QRMP / supprd column mapping (Kerala Tiles)
    console.log("=================")
  }

  const pushDuplicateRows = <T extends { supplierGSTIN: string; invoiceNumber: string }>(
    rows: T[],
    dupKeys: Set<string>,
    sourceRowsForDupOf: { supplierGSTIN: string; invoiceNumber: string }[],
    getB2b: (r: T) => GSTR2BRow | undefined,
    getPr: (r: T) => PurchaseRegisterRow | undefined,
  ) => {
    for (const r of rows) {
      const key = reconcileMatchKey(r.supplierGSTIN, r.invoiceNumber)
      if (!dupKeys.has(key)) continue
      const b2b = getB2b(r as never)
      const pr = getPr(r as never)
      const base = (b2b ?? pr) as GSTR2BRow & PurchaseRegisterRow
      const dupOf = firstInvoiceForKey(sourceRowsForDupOf, key)
      const totalITC = b2b ? b2b.igst + b2b.cgst + b2b.sgst : pr!.igst + pr!.cgst + pr!.sgst
      const extras = defaultRowFields()
      extras.isDuplicate = true
      extras.duplicateOf = dupOf
      const { action, urgency } = generateBaseAction(
        "Duplicate",
        b2b?.itcAvailable ?? null,
        base.supplierGSTIN,
        base.invoiceNumber,
        totalITC,
        null,
        null,
        b2b,
        pr,
      )
      results.push({
        supplierGSTIN: base.supplierGSTIN,
        supplierName: (b2b?.supplierName ?? pr?.supplierName) || "",
        invoiceNumber: base.invoiceNumber,
        documentType: (b2b?.documentType ?? "B2B") as DocumentType,
        rawInvoiceNumber2B: b2b?.rawInvoiceNumber ?? b2b?.invoiceNumber ?? null,
        rawInvoiceNumberPR: pr?.rawInvoiceNumber ?? pr?.invoiceNumber ?? null,
        normalisedInvoiceNumber2B: b2b ? normaliseInvoiceNumber(b2b.invoiceNumber) : null,
        normalisedInvoiceNumberPR: pr ? normaliseInvoiceNumber(pr.invoiceNumber) : null,
        invoiceDate: (b2b?.invoiceDate ?? pr?.invoiceDate) || "",
        placeOfSupply: (b2b?.placeOfSupply ?? pr?.placeOfSupply) || "",
        matchKey: key,
        status: "Duplicate",
        itcRisk: "Critical",
        itcAvailable: b2b?.itcAvailable ?? null,
        reverseCharge: b2b?.reverseCharge ?? null,
        taxable2B: b2b?.taxableValue ?? null,
        igst2B: b2b?.igst ?? null,
        cgst2B: b2b?.cgst ?? null,
        sgst2B: b2b?.sgst ?? null,
        taxablePR: pr?.taxableValue ?? null,
        igstPR: pr?.igst ?? null,
        cgstPR: pr?.cgst ?? null,
        sgstPR: pr?.sgst ?? null,
        taxableDiff: b2b && pr ? b2b.taxableValue - pr.taxableValue : null,
        igstDiff: b2b && pr ? b2b.igst - pr.igst : null,
        cgstDiff: b2b && pr ? b2b.cgst - pr.cgst : null,
        sgstDiff: b2b && pr ? b2b.sgst - pr.sgst : null,
        totalITCAtRisk: totalITC,
        recommendedAction: action,
        actionUrgency: urgency,
        riskSortOrder: 0,
        ...extras,
      })
    }
  }

  const { primary: gstr2bPrimary, extras: gstr2bDupExtras } = partitionRowsByDuplicateKey(gstr2bRows)
  const { primary: prPrimary, extras: prDupExtras } = partitionRowsByDuplicateKey(purchaseRows)
  const dupKeysB2BExtras = new Set(
    gstr2bDupExtras.map((r) => reconcileMatchKey(r.supplierGSTIN, r.invoiceNumber)),
  )
  const dupKeysPRExtras = new Set(prDupExtras.map((r) => reconcileMatchKey(r.supplierGSTIN, r.invoiceNumber)))
  pushDuplicateRows(gstr2bDupExtras, dupKeysB2BExtras, gstr2bRows, (r) => r as GSTR2BRow, () => undefined)
  pushDuplicateRows(prDupExtras, dupKeysPRExtras, purchaseRows, () => undefined, (r) => r as PurchaseRegisterRow)

  const prNonGstRows = prPrimary.filter(isNonGstPrRow)
  const prForMatching = prPrimary.filter((p) => !isNonGstPrRow(p))

  for (const pr of prNonGstRows) {
    const key = reconcileMatchKey(pr.supplierGSTIN ?? "", pr.invoiceNumber)
    const extras = defaultRowFields()
    results.push({
      supplierGSTIN: "",
      supplierName: pr.supplierName || "",
      invoiceNumber: pr.invoiceNumber,
      documentType: "B2B",
      rawInvoiceNumber2B: null,
      rawInvoiceNumberPR: pr.rawInvoiceNumber ?? pr.invoiceNumber ?? null,
      normalisedInvoiceNumber2B: null,
      normalisedInvoiceNumberPR: normaliseInvoiceNumber(pr.invoiceNumber),
      invoiceDate: pr.invoiceDate || "",
      placeOfSupply: pr.placeOfSupply || "",
      matchKey: key,
      status: "Non-GST Entry",
      itcRisk: "None",
      itcAvailable: null,
      reverseCharge: null,
      taxable2B: null,
      igst2B: null,
      cgst2B: null,
      sgst2B: null,
      taxablePR: pr.taxableValue ?? null,
      igstPR: pr.igst ?? null,
      cgstPR: pr.cgst ?? null,
      sgstPR: pr.sgst ?? null,
      taxableDiff: null,
      igstDiff: null,
      cgstDiff: null,
      sgstDiff: null,
      totalITCAtRisk: 0,
      recommendedAction:
        "No GSTIN and zero tax. Excluded from GST reconciliation scope.",
      actionUrgency: "None",
      riskSortOrder: getRiskSortOrder("None"),
      ...extras,
    })
  }

  const gstr2bMain = gstr2bPrimary
  const prMain = prForMatching

  const consumedB2B = new Set<string>()
  const consumedPR = new Set<string>()

  const map2B = new Map<string, GSTR2BRow>()
  gstr2bMain.forEach((row) => {
    const key = reconcileMatchKey(row.supplierGSTIN, row.invoiceNumber)
    if (!map2B.has(key)) map2B.set(key, row)
  })
  const mapPR = new Map<string, PurchaseRegisterRow>()
  prMain.forEach((row) => {
    const key = reconcileMatchKey(row.supplierGSTIN, row.invoiceNumber)
    if (!mapPR.has(key)) mapPR.set(key, row)
  })

  // M-1 exact (raw inv#) / QRMP / Sec 16(4) / M-3 date gap — before fuzzy & cross-GSTIN.
  for (const pr of prMain) {
    const key = reconcileMatchKey(pr.supplierGSTIN, pr.invoiceNumber)
    if (consumedPR.has(key)) continue
    const b2b = map2B.get(key)
    if (!b2b || consumedB2B.has(key)) continue
    if (!rawInvoiceExactEqual(b2b, pr)) continue
    if (!m1CoreAmountsMatch(b2b, pr, tolerance)) continue

    consumedB2B.add(key)
    consumedPR.add(key)

    const extras = defaultRowFields()
    let rowStatus: MismatchStatus = "Matched"

    if (supprdNotCurrentPeriod(b2b, recMonth, recYear)) {
      rowStatus = "QRMP Delay"
      extras.isQRMP = true
      extras.qrmpNote =
        "Supplier return period in GSTR-2B differs from this reconciliation period (QRMP / timing)."
      const itcAvailRes = applyItcAvailabilityStatus(rowStatus, b2b)
      rowStatus = itcAvailRes.status
      extras.itcBlockReason = itcAvailRes.itcBlockReason
    } else {
      const invForSec16 = (getB2bInvoiceDateForMatching(b2b) || pr.invoiceDate).trim()
      const sec16 = getITCDeadline(invForSec16)

      if (sec16?.isExpired) {
        extras.isDeadlineExpired = true
        extras.itcClaimDeadline = sec16.deadlineStr
        extras.daysToDeadline = sec16.daysRemaining
        rowStatus = "Sec 16(4) Expired"
      } else {
        if (sec16) {
          extras.itcClaimDeadline = sec16.deadlineStr
          extras.daysToDeadline = sec16.daysRemaining
          extras.isDeadlineWarning = sec16.isWarning && !sec16.isExpired
        }

        const dB = parseInvoiceDateFlexible(getB2bInvoiceDateForMatching(b2b))
        const dP = parseInvoiceDateFlexible(pr.invoiceDate)
        if (dB && dP) {
          const dayDiff = Math.abs(dB.getTime() - dP.getTime()) / 86400000
          if (dayDiff > 30) rowStatus = "Date Gap Match"
        }
      }

      const itcAvailRes = applyItcAvailabilityStatus(rowStatus, b2b)
      rowStatus = itcAvailRes.status
      extras.itcBlockReason = itcAvailRes.itcBlockReason

      if (
        (rowStatus === "Matched" || rowStatus === "Date Gap Match") &&
        b2b.reverseCharge === "Y"
      ) {
        rowStatus = "RCM Invoice"
        extras.isRCM = true
      }
    }

    const diffs = {
      taxable: b2b.taxableValue - pr.taxableValue,
      igst: b2b.igst - pr.igst,
      cgst: b2b.cgst - pr.cgst,
      sgst: b2b.sgst - pr.sgst,
    }
    const totalITCAtRisk = calcITCAtRisk(rowStatus, b2b, pr, {
      igst: diffs.igst,
      cgst: diffs.cgst,
      sgst: diffs.sgst,
    })
    let itcRisk = determineBaseRisk(rowStatus, b2b.itcAvailable, totalITCAtRisk)
    let { action, urgency } = generateBaseAction(
      rowStatus,
      b2b.itcAvailable,
      pr.supplierGSTIN,
      pr.invoiceNumber,
      totalITCAtRisk,
      diffs.taxable,
      extras.itcBlockReason,
      b2b,
      pr,
    )

    const sum2bTax = b2b.igst + b2b.cgst + b2b.sgst
    const deadlineNoticeAmt = totalITCAtRisk > 0 ? totalITCAtRisk : sum2bTax
    const invDate = (getB2bInvoiceDateForMatching(b2b) || pr.invoiceDate).trim()
    const mut = { itcRisk, action }
    applyITCDeadlineFieldsAndEscalation(rowStatus, invDate, deadlineNoticeAmt, extras, mut)
    itcRisk = mut.itcRisk
    action = mut.action

    if (extras.isDeadlineExpired) {
      itcRisk = "Critical"
    } else if (extras.isDeadlineWarning && itcRisk === "Medium") {
      itcRisk = "High"
    }

    pushPairRow(results, b2b, pr, key, rowStatus, itcRisk, action, urgency, tolerance)

    const last = results[results.length - 1]!
    last.itcBlockReason = extras.itcBlockReason
    last.isRCM = extras.isRCM === true
    last.isQRMP = extras.isQRMP === true
    last.qrmpNote = extras.qrmpNote
    last.itcClaimDeadline = extras.itcClaimDeadline
    last.daysToDeadline = extras.daysToDeadline
    last.isDeadlineWarning = extras.isDeadlineWarning
    last.isDeadlineExpired = extras.isDeadlineExpired
    last.recommendedAction = action
    last.itcRisk = itcRisk
  }

  for (const pr of prMain) {
    const key = reconcileMatchKey(pr.supplierGSTIN, pr.invoiceNumber)
    if (consumedPR.has(key)) continue
    let best: { b2b: GSTR2BRow; score: number } | null = null
    for (const b2b of gstr2bMain) {
      const kb = reconcileMatchKey(b2b.supplierGSTIN, b2b.invoiceNumber)
      if (consumedB2B.has(kb)) continue
      if (reconcileMatchKey(b2b.supplierGSTIN, b2b.invoiceNumber) === key && rawInvoiceExactEqual(b2b, pr)) {
        continue
      }
      if (b2b.supplierGSTIN !== pr.supplierGSTIN) continue
      const score = fuzzyMatchScore(b2b.invoiceNumber, pr.invoiceNumber)
      if (score >= 75 && valuesWithinFuzzyTolerance(b2b, pr, tolerance)) {
        if (!best || score > best.score) best = { b2b, score }
      }
    }
    if (best) {
      const kb = reconcileMatchKey(best.b2b.supplierGSTIN, best.b2b.invoiceNumber)
      consumedB2B.add(kb)
      consumedPR.add(key)
      const diffs = {
        taxable: best.b2b.taxableValue - pr.taxableValue,
        igst: best.b2b.igst - pr.igst,
        cgst: best.b2b.cgst - pr.cgst,
        sgst: best.b2b.sgst - pr.sgst,
      }
      const extras = defaultRowFields()
      extras.isSuggestedMatch = true
      extras.matchConfidence = best.score
      extras.suggestedMatchReason = buildSuggestedMatchReason(
        best.b2b.invoiceNumber,
        pr.invoiceNumber,
        best.score,
      )

      let rowStatus: MismatchStatus =
        best.b2b.reverseCharge === "Y" ? "RCM Invoice" : "Suggested Match"
      if (rowStatus === "RCM Invoice") extras.isRCM = true

      const itcAvailSuggested = applyItcAvailabilityStatus(rowStatus, best.b2b)
      rowStatus = itcAvailSuggested.status
      extras.itcBlockReason = itcAvailSuggested.itcBlockReason

      const tr2n = normalizeGstRatePercent(best.b2b.taxRate)
      extras.taxRate2B = tr2n ?? best.b2b.taxRate
      const trpInf = inferTaxRatePR(pr)
      extras.taxRatePR =
        pr.taxRate !== undefined && Number.isFinite(pr.taxRate) && pr.taxRate > 0
          ? normalizeGstRatePercent(pr.taxRate) ?? trpInf
          : trpInf
      if (taxRatesDisagree(best.b2b, pr)) {
        extras.isTaxRateMismatch = true
      }
      const cDiff = (best.b2b.cess ?? 0) - (pr.cess ?? 0)
      extras.cessDiff = cDiff
      if (Math.abs(cDiff) > 1) {
        extras.isCessMismatch = true
      }

      if (rowStatus === "Suggested Match" && extras.isCessMismatch && Math.abs(extras.cessDiff ?? 0) > 1) {
        rowStatus = "CESS Mismatch"
      }
      if (rowStatus === "Suggested Match" && extras.isTaxRateMismatch) {
        rowStatus = "Tax Rate Mismatch"
      }

      let totalITCAtRisk = calcITCAtRisk(rowStatus, best.b2b, pr, {
        igst: diffs.igst,
        cgst: diffs.cgst,
        sgst: diffs.sgst,
      })

      let itcRisk = determineBaseRisk(rowStatus, best.b2b.itcAvailable, totalITCAtRisk)

      let { action, urgency } = generateBaseAction(
        rowStatus,
        best.b2b.itcAvailable,
        pr.supplierGSTIN,
        pr.invoiceNumber,
        totalITCAtRisk,
        diffs.taxable,
        extras.itcBlockReason,
        best.b2b,
        pr,
      )

      const sum2bTax = best.b2b.igst + best.b2b.cgst + best.b2b.sgst
      const deadlineNoticeAmt = totalITCAtRisk > 0 ? totalITCAtRisk : sum2bTax

    const invDate = resolveInvoiceDateForDeadline(best.b2b, pr)
      const mut = { itcRisk, action }
      applyITCDeadlineFieldsAndEscalation(rowStatus, invDate, deadlineNoticeAmt, extras, mut)
      itcRisk = mut.itcRisk
      action = mut.action

      results.push({
        supplierGSTIN: pr.supplierGSTIN,
        supplierName: best.b2b.supplierName || pr.supplierName,
        invoiceNumber: pr.invoiceNumber,
        documentType: best.b2b.documentType ?? "B2B",
        rawInvoiceNumber2B: best.b2b.rawInvoiceNumber ?? best.b2b.invoiceNumber,
        rawInvoiceNumberPR: pr.rawInvoiceNumber ?? pr.invoiceNumber,
        normalisedInvoiceNumber2B: normaliseInvoiceNumber(best.b2b.invoiceNumber),
        normalisedInvoiceNumberPR: normaliseInvoiceNumber(pr.invoiceNumber),
        invoiceDate: best.b2b.invoiceDate || pr.invoiceDate,
        placeOfSupply: best.b2b.placeOfSupply || pr.placeOfSupply || "",
        matchKey: key,
        status: rowStatus,
        itcRisk,
        itcAvailable: best.b2b.itcAvailable,
        reverseCharge: best.b2b.reverseCharge,
        taxable2B: best.b2b.taxableValue,
        igst2B: best.b2b.igst,
        cgst2B: best.b2b.cgst,
        sgst2B: best.b2b.sgst,
        taxablePR: pr.taxableValue,
        igstPR: pr.igst,
        cgstPR: pr.cgst,
        sgstPR: pr.sgst,
        taxableDiff: diffs.taxable,
        igstDiff: diffs.igst,
        cgstDiff: diffs.cgst,
        sgstDiff: diffs.sgst,
        totalITCAtRisk,
        recommendedAction: action,
        actionUrgency: urgency,
        riskSortOrder: 0,
        ...extras,
      })
    }
  }

  runCrossGstinMatchingPasses(gstr2bMain, prMain, consumedB2B, consumedPR, tolerance, results)
  runProbableMonthMatchPass(gstr2bMain, prMain, consumedB2B, consumedPR, tolerance, results)

  const allKeys = new Set([...map2B.keys(), ...mapPR.keys()])
  for (const kb of consumedB2B) {
    allKeys.delete(kb)
  }
  for (const kp of consumedPR) {
    allKeys.delete(kp)
  }

  for (const key of allKeys) {
    if (consumedB2B.has(key) || consumedPR.has(key)) continue
    const b2b = map2B.get(key)
    const pr = mapPR.get(key)

    if (!b2b && pr) {
      let p2Matched = false
      for (const b2bC of gstr2bMain) {
        const bk = reconcileMatchKey(b2bC.supplierGSTIN, b2bC.invoiceNumber)
        if (consumedB2B.has(bk)) continue
        if (b2bC.supplierGSTIN.trim() !== pr.supplierGSTIN.trim()) continue
        if (normaliseInvoiceNumber(b2bC.invoiceNumber) === normaliseInvoiceNumber(pr.invoiceNumber)) continue
        const db = parseInvoiceDateFlexible(getB2bInvoiceDateForMatching(b2bC))
        const dp = parseInvoiceDateFlexible(pr.invoiceDate)
        if (!db || !dp) continue
        if (db.getMonth() !== dp.getMonth() || db.getFullYear() !== dp.getFullYear()) continue
        if (Math.abs(sumGstLines(b2bC) - sumGstLines(pr)) > P2_TOL_INR) continue
        consumedB2B.add(bk)
        consumedPR.add(key)
        pushPairRow(
          results,
          b2bC,
          pr,
          key,
          "Probable Month Match",
          "Medium",
          "Same supplier, same month, matching GST amount but different invoice number. Could be coincidence. Review carefully before claiming ITC.",
          "Before Filing",
          tolerance,
        )
        p2Matched = true
        break
      }
      if (p2Matched) continue
    }

    if (!b2b && !pr) continue
    const base = b2b ?? pr!
    let status = determineBaseStatus(b2b, pr, tolerance)

    if (b2b && pr && status === "Matched") {
      const d1 = parseInvoiceDateFlexible(getB2bInvoiceDateForMatching(b2b))
      const d2 = parseInvoiceDateFlexible(pr.invoiceDate)
      if (d1 && d2) {
        const dayDiff = Math.abs(d1.getTime() - d2.getTime()) / (86400000)
        if (dayDiff > 30) {
          status = "Date Gap Match"
        }
      }
    }

    const diffs = {
      taxable: b2b && pr ? b2b.taxableValue - pr.taxableValue : null,
      igst: b2b && pr ? b2b.igst - pr.igst : null,
      cgst: b2b && pr ? b2b.cgst - pr.cgst : null,
      sgst: b2b && pr ? b2b.sgst - pr.sgst : null,
    }

    const extras = defaultRowFields()

    if (status === "Tax Type Mismatch" && b2b && pr) {
      extras.isTaxTypeMismatch = true
      extras.totalTax2B = b2b.igst + b2b.cgst + b2b.sgst
      extras.totalTaxPR = pr.igst + pr.cgst + pr.sgst
    }

    if (status === "Value Mismatch" && b2b && pr && detectTaxTypeMismatch(b2b, pr)) {
      status = "Tax Type Mismatch"
      extras.isTaxTypeMismatch = true
      extras.totalTax2B = b2b.igst + b2b.cgst + b2b.sgst
      extras.totalTaxPR = pr.igst + pr.cgst + pr.sgst
    }

    if (b2b?.reverseCharge === "Y") {
      status = "RCM Invoice"
      extras.isRCM = true
    }

    const itcAvailRes = applyItcAvailabilityStatus(status, b2b)
    status = itcAvailRes.status
    extras.itcBlockReason = itcAvailRes.itcBlockReason

    if (b2b && pr) {
      const tr2n = normalizeGstRatePercent(b2b.taxRate)
      extras.taxRate2B = tr2n ?? b2b.taxRate
      const trpInf = inferTaxRatePR(pr)
      const trpn =
        pr.taxRate !== undefined && Number.isFinite(pr.taxRate) && pr.taxRate > 0
          ? normalizeGstRatePercent(pr.taxRate)
          : trpInf
      extras.taxRatePR = trpn ?? trpInf
      if (taxRatesDisagree(b2b, pr)) {
        extras.isTaxRateMismatch = true
      }
      const cDiff = (b2b.cess ?? 0) - (pr.cess ?? 0)
      extras.cessDiff = cDiff
      if (Math.abs(cDiff) > 1) {
        extras.isCessMismatch = true
      }

    }

    if ((status === "Matched" || status === "Date Gap Match") && extras.isTaxRateMismatch) {
      status = "Tax Rate Mismatch"
    }
    if (
      (status === "Matched" || status === "Date Gap Match") &&
      extras.isCessMismatch &&
      Math.abs(extras.cessDiff ?? 0) > 1
    ) {
      status = "CESS Mismatch"
    }

    let totalITCAtRisk = calcITCAtRisk(status, b2b, pr, {
      igst: diffs.igst ?? 0,
      cgst: diffs.cgst ?? 0,
      sgst: diffs.sgst ?? 0,
    })
    let itcRisk = determineBaseRisk(status, b2b?.itcAvailable ?? null, totalITCAtRisk)

    let { action, urgency } = generateBaseAction(
      status,
      b2b?.itcAvailable ?? null,
      base.supplierGSTIN,
      base.invoiceNumber,
      totalITCAtRisk,
      diffs.taxable,
      extras.itcBlockReason,
      b2b,
      pr,
    )

    let recommendedAction = action
    let actionUrgency = urgency

    const sum2bForNotice = b2b ? b2b.igst + b2b.cgst + b2b.sgst : 0
    const sumPrForNotice = pr ? pr.igst + pr.cgst + pr.sgst : 0
    const deadlineNoticeAmt =
      totalITCAtRisk > 0 ? totalITCAtRisk : sum2bForNotice > 0 ? sum2bForNotice : sumPrForNotice

    const invForDeadline = resolveInvoiceDateForDeadline(b2b, pr)
    const mutMain = { itcRisk, action: recommendedAction }
    applyITCDeadlineFieldsAndEscalation(status, invForDeadline, deadlineNoticeAmt, extras, mutMain)
    itcRisk = mutMain.itcRisk
    recommendedAction = mutMain.action

    if (status === "In PR Only" && pr && recMonth && recYear) {
      const id = parseInvoiceDateFlexible(pr.invoiceDate)
      if (id) {
        const invYM = id.getFullYear() * 12 + id.getMonth()
        const recYM = recYear * 12 + (recMonth - 1)
        const monthGap = recYM - invYM
        if (monthGap >= 1 && monthGap <= 2) {
          status = "Period Timing Mismatch"
          extras.isTimingMismatch = true
          extras.timingNote =
            "Period timing: invoice is 1–2 months before this reconciliation period and missing from current GSTR-2B — supplier may have filed late; check next period before treating as missing."
          itcRisk = "Medium"
          actionUrgency = "Monitor"
          recommendedAction =
            "Invoice date falls in the prior month(s) relative to this GSTR-2B period. Supplier filing may appear next period — verify next month's GSTR-2B before following up as a missing invoice."
        } else if (invYM < recYM) {
          extras.isTimingMismatch = true
          extras.timingNote = `Invoice dated ${pr.invoiceDate} is before ${recMonth}/${recYear} GSTR-2B. Supplier may have filed late — check next month's GSTR-2B before following up.`
          if (itcRisk === "High") itcRisk = "Medium"
          if (actionUrgency === "Immediate") actionUrgency = "Monitor"
        }
      }
    }

    if (status === "Period Timing Mismatch") {
      totalITCAtRisk = calcITCAtRisk(
        "Period Timing Mismatch",
        b2b,
        pr,
        {
          igst: diffs.igst ?? 0,
          cgst: diffs.cgst ?? 0,
          sgst: diffs.sgst ?? 0,
        },
      )
    }

    if (status === "Duplicate" || extras.isDuplicate) itcRisk = "Critical"

    results.push({
      supplierGSTIN: base.supplierGSTIN,
      supplierName: b2b?.supplierName ?? pr?.supplierName ?? "",
      invoiceNumber: base.invoiceNumber,
      documentType: (b2b?.documentType ?? "B2B") as DocumentType,
      rawInvoiceNumber2B: b2b?.rawInvoiceNumber ?? b2b?.invoiceNumber ?? null,
      rawInvoiceNumberPR: pr?.rawInvoiceNumber ?? pr?.invoiceNumber ?? null,
      normalisedInvoiceNumber2B: b2b ? normaliseInvoiceNumber(b2b.invoiceNumber) : null,
      normalisedInvoiceNumberPR: pr ? normaliseInvoiceNumber(pr.invoiceNumber) : null,
      invoiceDate: b2b?.invoiceDate ?? pr?.invoiceDate ?? "",
      placeOfSupply: b2b?.placeOfSupply ?? pr?.placeOfSupply ?? "",
      matchKey: key,
      status,
      itcRisk,
      itcAvailable: b2b?.itcAvailable ?? null,
      reverseCharge: b2b?.reverseCharge ?? null,
      taxable2B: b2b?.taxableValue ?? null,
      igst2B: b2b?.igst ?? null,
      cgst2B: b2b?.cgst ?? null,
      sgst2B: b2b?.sgst ?? null,
      taxablePR: pr?.taxableValue ?? null,
      igstPR: pr?.igst ?? null,
      cgstPR: pr?.cgst ?? null,
      sgstPR: pr?.sgst ?? null,
      taxableDiff: diffs.taxable,
      igstDiff: diffs.igst,
      cgstDiff: diffs.cgst,
      sgstDiff: diffs.sgst,
      totalITCAtRisk,
      recommendedAction,
      actionUrgency,
      riskSortOrder: getRiskSortOrder(itcRisk),
      ...extras,
    })
  }

  applyCrossPeriodQrmpOverrides(results, map2B, recMonth, recYear)

  applyPostMatchQueryChecks(results, map2B, mapPR, tolerance)

  for (const r of results) {
    r.totalITCAtRisk = computeRowTotalITCAtRisk(r)
  }

  for (const r of results) {
    r.riskSortOrder = Math.round(computeListSortOrder(r))
  }

  for (const r of results) {
    if (r.status === "QRMP Delay") {
      r.riskSortOrder = 99
    }
  }

  applyPOSMismatchPhase(results, map2B, mapPR, tolerance)

  for (const r of results) {
    r.totalITCAtRisk = computeRowTotalITCAtRisk(r)
  }

  for (const r of results) {
    r.riskSortOrder = Math.round(computeListSortOrder(r))
  }

  for (const r of results) {
    if (r.status === "QRMP Delay") {
      r.riskSortOrder = 99
    }
  }

  for (const r of results) {
    if (
      r.isDeadlineExpired &&
      r.status !== "Duplicate" &&
      r.status !== "QRMP Delay" &&
      r.status !== "Non-GST Entry" &&
      r.status !== "ITC Blocked" &&
      r.status !== "ITC Temporary"
    ) {
      r.status = "Sec 16(4) Expired"
      r.itcRisk = "Critical"
    }
  }

  for (const r of results) {
    r.totalITCAtRisk = computeRowTotalITCAtRisk(r)
  }

  for (const r of results) {
    r.riskSortOrder = Math.round(computeListSortOrder(r))
  }

  for (const r of results) {
    if (r.status === "QRMP Delay") {
      r.riskSortOrder = 99
    }
  }

  results.sort((a, b) => {
    if (a.riskSortOrder !== b.riskSortOrder) return a.riskSortOrder - b.riskSortOrder
    return b.totalITCAtRisk - a.totalITCAtRisk
  })

  const summary = buildReconciliationSummary(results)

  return { rows: results, summary }
}

/** ITC buckets for GSTR-3B Table 4 entry guidance (from reconciled rows). */
export interface GSTR3BSummary {
  eligibleIGST: number
  eligibleCGST: number
  eligibleSGST: number
  eligibleTotal: number
  ineligibleIGST: number
  ineligibleCGST: number
  ineligibleSGST: number
  ineligibleTotal: number
  deferredIGST: number
  deferredCGST: number
  deferredSGST: number
  deferredTotal: number
  qrmpIGST: number
  qrmpCGST: number
  qrmpSGST: number
  qrmpTotal: number
  netClaimableIGST: number
  netClaimableCGST: number
  netClaimableSGST: number
  netClaimableTotal: number
  /** Sum of 2B-side IGST+CGST+SGST for matched-safe B2BA rows (informational). */
  b2baITC: number
  /** Matched-safe CDNR: sum of 2B taxes (negative reduces claim). */
  creditNoteITC: number
  /** Matched-safe CDNR-DN: sum of 2B taxes (positive). */
  debitNoteITC: number
  /** Net 4A(5) guidance after note adjustments. */
  netAfterNotes: number
}

function sumTax2B(rows: ReconciliationRow[]): { igst: number; cgst: number; sgst: number; total: number } {
  let ig = 0
  let cg = 0
  let sg = 0
  for (const r of rows) {
    ig += r.igst2B ?? 0
    cg += r.cgst2B ?? 0
    sg += r.sgst2B ?? 0
  }
  return { igst: ig, cgst: cg, sgst: sg, total: ig + cg + sg }
}

function sumTaxPR(rows: ReconciliationRow[]): { igst: number; cgst: number; sgst: number; total: number } {
  let ig = 0
  let cg = 0
  let sg = 0
  for (const r of rows) {
    ig += r.igstPR ?? 0
    cg += r.cgstPR ?? 0
    sg += r.sgstPR ?? 0
  }
  return { igst: ig, cgst: cg, sgst: sg, total: ig + cg + sg }
}

/** QRMP deferred ITC: use PR when present, else GSTR-2B (e.g. former In 2B Only rows). */
function sumTaxQrmpDeferred(rows: ReconciliationRow[]): {
  igst: number
  cgst: number
  sgst: number
  total: number
} {
  let ig = 0
  let cg = 0
  let sg = 0
  for (const r of rows) {
    const prTotal = (r.igstPR ?? 0) + (r.cgstPR ?? 0) + (r.sgstPR ?? 0)
    if (prTotal > 0) {
      ig += r.igstPR ?? 0
      cg += r.cgstPR ?? 0
      sg += r.sgstPR ?? 0
    } else {
      ig += r.igst2B ?? 0
      cg += r.cgst2B ?? 0
      sg += r.sgst2B ?? 0
    }
  }
  return { igst: ig, cgst: cg, sgst: sg, total: ig + cg + sg }
}

export function calculateGSTR3BSummary(rows: ReconciliationRow[]): GSTR3BSummary {
  const eligiblePredicate = (r: ReconciliationRow) =>
    r.status === "Matched" &&
    r.itcRisk === "Safe" &&
    r.itcAvailable === "Y" &&
    r.isPOSMismatch !== true

  const eligibleRows = rows.filter(eligiblePredicate)
  const ineligibleRows = rows.filter((r) => r.itcAvailable === "N")
  const deferredRows = rows.filter((r) => r.status === "In PR Only" && !r.isDeadlineExpired)
  const qrmpRows = rows.filter((r) => r.status === "QRMP Delay")

  const e = sumTax2B(eligibleRows)
  const i = sumTax2B(ineligibleRows)
  const d = sumTaxPR(deferredRows)
  const q = sumTaxQrmpDeferred(qrmpRows)

  const eligibleB2bBa = eligibleRows.filter(
    (r) => r.documentType === "B2B" || r.documentType === "B2BA" || r.documentType === undefined,
  )
  const eCore = sumTax2B(eligibleB2bBa)

  const eligibleCdnr = eligibleRows.filter((r) => r.documentType === "CDNR")
  const eligibleDn = eligibleRows.filter((r) => r.documentType === "CDNR-DN")
  const eligibleB2baOnly = eligibleRows.filter((r) => r.documentType === "B2BA")

  const creditNoteITC = sumTax2B(eligibleCdnr).total
  const debitNoteITC = sumTax2B(eligibleDn).total
  const b2baITC = sumTax2B(eligibleB2baOnly).total

  const netAfterNotes = eCore.total + creditNoteITC + debitNoteITC

  return {
    eligibleIGST: e.igst,
    eligibleCGST: e.cgst,
    eligibleSGST: e.sgst,
    eligibleTotal: e.total,
    ineligibleIGST: i.igst,
    ineligibleCGST: i.cgst,
    ineligibleSGST: i.sgst,
    ineligibleTotal: i.total,
    deferredIGST: d.igst,
    deferredCGST: d.cgst,
    deferredSGST: d.sgst,
    deferredTotal: d.total,
    qrmpIGST: q.igst,
    qrmpCGST: q.cgst,
    qrmpSGST: q.sgst,
    qrmpTotal: q.total,
    netClaimableIGST: e.igst,
    netClaimableCGST: e.cgst,
    netClaimableSGST: e.sgst,
    netClaimableTotal: e.total,
    b2baITC,
    creditNoteITC,
    debitNoteITC,
    netAfterNotes,
  }
}
