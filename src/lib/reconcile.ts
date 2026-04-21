import type {
  ActionUrgency,
  AppConfig,
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
  makeMatchKey,
  parseInvoiceDateFlexible,
  validatePOS,
} from "@/lib/utils"

/** QRMP filing periods use return months 01, 04, 07, 10 (MMYYYY). */
export function isQRMPSupplier(supprd: string): boolean {
  if (!supprd || supprd.length < 6) return false
  const month = Number.parseInt(supprd.substring(0, 2), 10)
  if (!Number.isFinite(month)) return false
  return [1, 4, 7, 10].includes(month)
}

export function checkIfQRMPFromSameSupplier(
  supplierGSTIN: string,
  rows2b: GSTR2BRow[],
): boolean {
  const norm = supplierGSTIN.trim()
  for (const r of rows2b) {
    if (r.supplierGSTIN.trim() !== norm) continue
    const sp = (r.supprd ?? "").trim()
    if (isQRMPSupplier(sp)) return true
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
    let day: number
    let month: number
    let year: number

    if (invoiceDate.includes("-")) {
      const parts = invoiceDate.split("-")
      if (parts[0].length === 4) {
        year = Number.parseInt(parts[0], 10)
        month = Number.parseInt(parts[1], 10)
        day = Number.parseInt(parts[2], 10)
      } else {
        day = Number.parseInt(parts[0], 10)
        month = Number.parseInt(parts[1], 10)
        year = Number.parseInt(parts[2], 10)
      }
    } else if (invoiceDate.includes("/")) {
      const parts = invoiceDate.split("/")
      day = Number.parseInt(parts[0], 10)
      month = Number.parseInt(parts[1], 10)
      year = Number.parseInt(parts[2], 10)
    } else {
      return null
    }

    if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) {
      return null
    }

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

function shouldComputeITCDeadline(status: MismatchStatus): boolean {
  return status === "In PR Only" || status === "Suggested Match" || status === "Value Mismatch"
}

function applyITCDeadlineFieldsAndEscalation(
  status: MismatchStatus,
  invoiceDateStr: string,
  totalITCAtRisk: number,
  extras: ReturnType<typeof defaultRowFields>,
  mut: { itcRisk: ITCRiskLevel; action: string },
): void {
  if (!shouldComputeITCDeadline(status) || !invoiceDateStr.trim()) return
  const meta = getITCDeadline(invoiceDateStr.trim())
  if (!meta) return

  extras.itcClaimDeadline = meta.deadlineStr
  extras.daysToDeadline = meta.daysRemaining
  extras.isDeadlineWarning = meta.isWarning
  extras.isDeadlineExpired = meta.isExpired

  if (meta.isExpired && status === "In PR Only") {
    mut.itcRisk = "Critical"
    mut.action =
      `⚠️ ITC DEADLINE EXPIRED. Deadline was ${meta.deadlineStr}. This ITC of ${formatINR(totalITCAtRisk)} can no longer be claimed under Section 16(4). ` +
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
    const k = makeMatchKey(r.supplierGSTIN, r.invoiceNumber)
    count.set(k, (count.get(k) ?? 0) + 1)
  }
  const dup = new Set<string>()
  for (const [k, n] of count) {
    if (n > 1) dup.add(k)
  }
  return dup
}

function firstInvoiceForKey<T extends { supplierGSTIN: string; invoiceNumber: string }>(
  rows: T[],
  key: string,
): string {
  const r = rows.find((x) => makeMatchKey(x.supplierGSTIN, x.invoiceNumber) === key)
  return r?.invoiceNumber ?? ""
}

function detectTaxTypeMismatch(b2b: GSTR2BRow, pr: PurchaseRegisterRow): boolean {
  const total2B = b2b.igst + b2b.cgst + b2b.sgst
  const totalPR = pr.igst + pr.cgst + pr.sgst
  if (Math.abs(total2B - totalPR) > 2) return false
  const igstDiffers = Math.abs(b2b.igst - pr.igst) > 1
  const cgstDiffers = Math.abs(b2b.cgst - pr.cgst) > 1
  const sgstDiffers = Math.abs(b2b.sgst - pr.sgst) > 1
  return igstDiffers || cgstDiffers || sgstDiffers
}

function valuesWithinFuzzyTolerance(b2b: GSTR2BRow, pr: PurchaseRegisterRow, tol: number): boolean {
  return (
    Math.abs(b2b.taxableValue - pr.taxableValue) <= 100 &&
    Math.abs(b2b.igst + b2b.cgst + b2b.sgst - (pr.igst + pr.cgst + pr.sgst)) <= 100
  )
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
  const diffs = [
    Math.abs(b2b!.taxableValue - pr!.taxableValue),
    Math.abs(b2b!.igst - pr!.igst),
    Math.abs(b2b!.cgst - pr!.cgst),
    Math.abs(b2b!.sgst - pr!.sgst),
  ]
  const hasSignificantDiff = diffs.some((d) => d > tolerance)
  return hasSignificantDiff ? "Value Mismatch" : "Matched"
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
    case "Tax Type Mismatch":
      return Math.abs(diffs.igst) + Math.abs(diffs.cgst) + Math.abs(diffs.sgst)
    case "In 2B Only":
      return b2b ? b2b.igst + b2b.cgst + b2b.sgst : 0
    case "In PR Only":
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
    default:
      return 0
  }
}

function determineBaseRisk(
  status: MismatchStatus,
  itcAvailable: ITCStatus | null,
  totalITCAtRisk: number,
): ITCRiskLevel {
  void totalITCAtRisk
  if (itcAvailable === "N") return "Critical"
  if (status === "QRMP Delay") return "Safe"
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

function maxRisk(a: ITCRiskLevel, b: ITCRiskLevel): ITCRiskLevel {
  const o: Record<ITCRiskLevel, number> = { Safe: 0, Medium: 1, High: 2, Critical: 3 }
  return o[a] >= o[b] ? a : b
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

  if (status === "QRMP Delay" && pr) {
    const expected = qrmpExpectedGstr2BMonthLabel(pr.invoiceDate)
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

  if (status === "In PR Only") {
    return {
      action: `Supplier ${gstin} has NOT filed GSTR-1. Invoice ${inv} is missing from GSTR-2B. Do NOT claim ${itcStr} ITC until supplier files. Send follow-up requesting GSTR-1 filing.`,
      urgency: "Immediate",
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

function computeListSortOrder(row: ReconciliationRow): number {
  let tier = 50
  if (row.status === "Duplicate" || row.isDuplicate) tier = 1
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
  else if (row.status === "In PR Only" && row.isTimingMismatch) tier = 12
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
  const recMonth = reconciliationPeriod?.month
  const recYear = reconciliationPeriod?.year

  const dup2B = detectDuplicateKeys(gstr2bRows)
  const dupPR = detectDuplicateKeys(purchaseRows)

  const results: ReconciliationRow[] = []

  const pushDuplicateRows = <T extends { supplierGSTIN: string; invoiceNumber: string }>(
    rows: T[],
    dupKeys: Set<string>,
    getB2b: (r: T) => GSTR2BRow | undefined,
    getPr: (r: T) => PurchaseRegisterRow | undefined,
  ) => {
    for (const r of rows) {
      const key = makeMatchKey(r.supplierGSTIN, r.invoiceNumber)
      if (!dupKeys.has(key)) continue
      const b2b = getB2b(r as never)
      const pr = getPr(r as never)
      const base = (b2b ?? pr) as GSTR2BRow & PurchaseRegisterRow
      const dupOf = firstInvoiceForKey(rows as { supplierGSTIN: string; invoiceNumber: string }[], key)
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

  pushDuplicateRows(gstr2bRows, dup2B, (r) => r as GSTR2BRow, () => undefined)
  pushDuplicateRows(purchaseRows, dupPR, () => undefined, (r) => r as PurchaseRegisterRow)

  const gstr2bMain = gstr2bRows.filter((r) => !dup2B.has(makeMatchKey(r.supplierGSTIN, r.invoiceNumber)))
  const prMain = purchaseRows.filter((r) => !dupPR.has(makeMatchKey(r.supplierGSTIN, r.invoiceNumber)))

  const consumedB2B = new Set<string>()
  const consumedPR = new Set<string>()

  const map2B = new Map<string, GSTR2BRow>()
  gstr2bMain.forEach((row) => {
    const key = makeMatchKey(row.supplierGSTIN, row.invoiceNumber)
    if (!map2B.has(key)) map2B.set(key, row)
  })
  const mapPR = new Map<string, PurchaseRegisterRow>()
  prMain.forEach((row) => {
    const key = makeMatchKey(row.supplierGSTIN, row.invoiceNumber)
    if (!mapPR.has(key)) mapPR.set(key, row)
  })

  for (const pr of prMain) {
    const key = makeMatchKey(pr.supplierGSTIN, pr.invoiceNumber)
    if (consumedPR.has(key)) continue
    if (map2B.has(key)) continue
    let best: { b2b: GSTR2BRow; score: number } | null = null
    for (const b2b of gstr2bMain) {
      const kb = makeMatchKey(b2b.supplierGSTIN, b2b.invoiceNumber)
      if (consumedB2B.has(kb)) continue
      if (makeMatchKey(b2b.supplierGSTIN, b2b.invoiceNumber) === key) continue
      if (b2b.supplierGSTIN !== pr.supplierGSTIN) continue
      const score = fuzzyMatchScore(b2b.invoiceNumber, pr.invoiceNumber)
      if (score >= 80 && valuesWithinFuzzyTolerance(b2b, pr, tolerance)) {
        if (!best || score > best.score) best = { b2b, score }
      }
    }
    if (best) {
      const kb = makeMatchKey(best.b2b.supplierGSTIN, best.b2b.invoiceNumber)
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

      const totalITCAtRisk = calcITCAtRisk(rowStatus, best.b2b, pr, {
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
        null,
        best.b2b,
        pr,
      )

      const tr2 = best.b2b.taxRate
      const trp = inferTaxRatePR(pr)
      extras.taxRate2B = tr2
      extras.taxRatePR = trp
      if (trp !== null && Number.isFinite(tr2) && Math.abs(tr2 - trp) > 0.5) {
        extras.isTaxRateMismatch = true
        action += ` Note: Tax rate differs — GSTR-2B shows ${tr2}% but books show ${trp}%. Verify HSN code classification.`
      }
      const cDiff = (best.b2b.cess ?? 0) - (pr.cess ?? 0)
      extras.cessDiff = cDiff
      if (Math.abs(cDiff) > 1) {
        extras.isCessMismatch = true
        action += ` CESS difference of ${formatINR(Math.abs(cDiff))} detected. Verify if CESS applies to this supply.`
        if (Math.abs(cDiff) > 1000) itcRisk = maxRisk(itcRisk, "Medium")
      }

      const pos = validatePOS(best.b2b, recipientGSTIN)
      if (pos.hasMismatch) {
        extras.isPOSMismatch = true
        extras.posWarning = pos.warning
        itcRisk = maxRisk(itcRisk, "Medium")
      }

      if (rowStatus === "Suggested Match") {
        const invDate = (pr.invoiceDate || best.b2b.invoiceDate || "").trim()
        const mut = { itcRisk, action }
        applyITCDeadlineFieldsAndEscalation(rowStatus, invDate, totalITCAtRisk, extras, mut)
        itcRisk = mut.itcRisk
        action = mut.action
      }

      results.push({
        supplierGSTIN: pr.supplierGSTIN,
        supplierName: best.b2b.supplierName || pr.supplierName,
        invoiceNumber: pr.invoiceNumber,
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
    if (!b2b && !pr) continue
    const base = b2b ?? pr!
    let status = determineBaseStatus(b2b, pr, tolerance)
    const diffs = {
      taxable: b2b && pr ? b2b.taxableValue - pr.taxableValue : null,
      igst: b2b && pr ? b2b.igst - pr.igst : null,
      cgst: b2b && pr ? b2b.cgst - pr.cgst : null,
      sgst: b2b && pr ? b2b.sgst - pr.sgst : null,
    }

    let itcBlock: ITCBlockReason = null
    if (b2b?.itcAvailable === "N") {
      const code = extractItcBlockCode(b2b.itcUnavailableReason)
      if (code === "P") itcBlock = "permanent"
      else if (code === "C") itcBlock = "conditional"
      else itcBlock = null
    }

    const extras = defaultRowFields()
    extras.itcBlockReason = itcBlock

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

    if (status === "In PR Only" && pr) {
      const fromSuprd = checkIfQRMPFromSameSupplier(pr.supplierGSTIN, gstr2bMain)
      const timing =
        recMonth != null && recYear != null
          ? isLikelyTimingDelay(pr.invoiceDate, recMonth, recYear)
          : false
      if (fromSuprd || timing) {
        status = "QRMP Delay"
        extras.isQRMP = true
        extras.qrmpNote =
          "QRMP suppliers file quarterly. April invoices appear in June GSTR-2B, July invoices in September, etc."
      }
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
      itcBlock,
      b2b,
      pr,
    )

    let recommendedAction = action
    let actionUrgency = urgency

    if (b2b && pr) {
      const tr2 = b2b.taxRate
      const trp = inferTaxRatePR(pr)
      extras.taxRate2B = tr2
      extras.taxRatePR = trp
      if (trp !== null && Number.isFinite(tr2) && Math.abs(tr2 - trp) > 0.5) {
        extras.isTaxRateMismatch = true
        recommendedAction += ` Note: Tax rate differs — GSTR-2B shows ${tr2}% but books show ${trp}%. Verify HSN classification.`
      }
      const cDiff = (b2b.cess ?? 0) - (pr.cess ?? 0)
      extras.cessDiff = cDiff
      if (Math.abs(cDiff) > 1) {
        extras.isCessMismatch = true
        recommendedAction += ` CESS difference of ${formatINR(Math.abs(cDiff))} detected. Verify if CESS applies.`
        if (Math.abs(cDiff) > 1000) itcRisk = maxRisk(itcRisk, "Medium")
      }
      const pos = validatePOS(b2b, recipientGSTIN)
      if (pos.hasMismatch) {
        extras.isPOSMismatch = true
        extras.posWarning = pos.warning
        itcRisk = maxRisk(itcRisk, "Medium")
      }
    }

    const invForDeadline = (pr?.invoiceDate || b2b?.invoiceDate || "").trim()
    const mutMain = { itcRisk, action: recommendedAction }
    applyITCDeadlineFieldsAndEscalation(status, invForDeadline, totalITCAtRisk, extras, mutMain)
    itcRisk = mutMain.itcRisk
    recommendedAction = mutMain.action

    if (status === "In PR Only" && pr && recMonth && recYear) {
      const id = parseInvoiceDateFlexible(pr.invoiceDate)
      if (id) {
        const periodStart = new Date(recYear, recMonth - 1, 1)
        const invStart = new Date(id.getFullYear(), id.getMonth(), 1)
        if (invStart < periodStart) {
          extras.isTimingMismatch = true
          extras.timingNote = `Invoice dated ${pr.invoiceDate} is not in ${recMonth}/${recYear} GSTR-2B. Supplier may have filed late — check next month's GSTR-2B before following up.`
          if (itcRisk === "High") itcRisk = "Medium"
          if (actionUrgency === "Immediate") actionUrgency = "Monitor"
        }
      }
    }

    if (extras.isPOSMismatch) itcRisk = maxRisk(itcRisk, "Medium")
    if (extras.isCessMismatch && Math.abs(extras.cessDiff ?? 0) > 1000) {
      itcRisk = maxRisk(itcRisk, "Medium")
    }
    if (status === "Duplicate" || extras.isDuplicate) itcRisk = "Critical"

    results.push({
      supplierGSTIN: base.supplierGSTIN,
      supplierName: b2b?.supplierName ?? pr?.supplierName ?? "",
      invoiceNumber: base.invoiceNumber,
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

  for (const r of results) {
    r.riskSortOrder = Math.round(computeListSortOrder(r))
  }

  results.sort((a, b) => {
    if (a.riskSortOrder !== b.riskSortOrder) return a.riskSortOrder - b.riskSortOrder
    return b.totalITCAtRisk - a.totalITCAtRisk
  })

  const totalCESSAtRisk = results.reduce((s, r) => s + Math.abs(r.cessDiff ?? 0), 0)

  const summary: ReconciliationSummary = {
    totalInvoices: results.length,
    matchedCount: results.filter((r) => r.status === "Matched").length,
    valueMismatchCount: results.filter((r) => r.status === "Value Mismatch").length,
    in2BOnlyCount: results.filter((r) => r.status === "In 2B Only").length,
    inPROnlyCount: results.filter((r) => r.status === "In PR Only").length,
    qrmpCount: results.filter((r) => r.status === "QRMP Delay").length,
    totalITCAtRisk: results.reduce((s, r) => s + r.totalITCAtRisk, 0),
    totalITCSafe: results
      .filter((r) => r.status === "Matched")
      .reduce((s, r) => s + (r.igst2B ?? 0) + (r.cgst2B ?? 0) + (r.sgst2B ?? 0), 0),
    taxTypeMismatchCount: results.filter((r) => r.status === "Tax Type Mismatch").length,
    suggestedMatchCount: results.filter((r) => r.status === "Suggested Match").length,
    duplicateCount: results.filter((r) => r.status === "Duplicate").length,
    rcmInvoiceCount: results.filter((r) => r.status === "RCM Invoice").length,
    deadlineExpiredCount: results.filter((r) => r.isDeadlineExpired).length,
    deadlineWarningCount: results.filter((r) => r.isDeadlineWarning && !r.isDeadlineExpired).length,
    posMismatchCount: results.filter((r) => r.isPOSMismatch).length,
    totalCESSAtRisk,
  }

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

export function calculateGSTR3BSummary(rows: ReconciliationRow[]): GSTR3BSummary {
  const eligibleRows = rows.filter((r) => r.status === "Matched" && r.itcAvailable === "Y")
  const ineligibleRows = rows.filter((r) => r.itcAvailable === "N")
  const deferredRows = rows.filter((r) => r.status === "In PR Only" && !r.isDeadlineExpired)
  const qrmpRows = rows.filter((r) => r.status === "QRMP Delay")

  const e = sumTax2B(eligibleRows)
  const i = sumTax2B(ineligibleRows)
  const d = sumTaxPR(deferredRows)
  const q = sumTaxPR(qrmpRows)

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
  }
}
