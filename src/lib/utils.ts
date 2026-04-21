import { clsx, type ClassValue } from "clsx"
import { customAlphabet } from "nanoid"
import { twMerge } from "tailwind-merge"

import type { ITCRiskLevel, MismatchStatus, ReconciliationRow } from "@/lib/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "—"
  }
  return amount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })
}

function sumTaxPR(row: ReconciliationRow): number {
  return (row.igstPR ?? 0) + (row.cgstPR ?? 0) + (row.sgstPR ?? 0)
}

/** One-click vendor follow-up text for email / WhatsApp (non-Matched rows). */
export function generateVendorMessage(
  row: ReconciliationRow,
  period: string,
  caName?: string,
): string {
  if (row.status === "Matched" || row.status === "QRMP Delay") return ""

  const closing = (caName?.trim() || "Your CA").trim()
  const supplier = (row.supplierName?.trim() || "Sir/Madam").trim()
  const periodLabel = period.trim() || "the relevant return period"

  switch (row.status) {
    case "In PR Only": {
      const taxable = row.taxablePR
      const tax = sumTaxPR(row)
      return [
        `Dear ${supplier},`,
        "",
        `We are reconciling our GSTR-2B for ${periodLabel}.`,
        "",
        "The following invoice is not reflecting in our GSTR-2B:",
        "",
        `Invoice No  : ${row.invoiceNumber}`,
        `Invoice Date: ${row.invoiceDate}`,
        `Taxable Value: ${formatINR(taxable)}`,
        `IGST / CGST+SGST: ${formatINR(tax)}`,
        "",
        "Request you to file / amend your GSTR-1 at the earliest so we can claim our ITC.",
        "",
        `Your GSTIN: ${row.supplierGSTIN}`,
        "",
        "Regards,",
        closing,
      ].join("\n")
    }
    case "Value Mismatch": {
      const diffVal = row.taxableDiff ?? (row.taxable2B ?? 0) - (row.taxablePR ?? 0)
      const diffLine = formatDiff(diffVal).text
      const diffDisplay = diffLine !== "—" ? diffLine : formatINR(Math.abs(diffVal))
      return [
        `Dear ${supplier},`,
        "",
        `We are reconciling our GSTR-2B for ${periodLabel}.`,
        "",
        `Invoice ${row.invoiceNumber} dated ${row.invoiceDate} has a value difference:`,
        "",
        `As per GSTR-2B : ${formatINR(row.taxable2B)}`,
        `As per our books: ${formatINR(row.taxablePR)}`,
        `Difference      : ${diffDisplay}`,
        "",
        `Request you to verify and amend Invoice ${row.invoiceNumber} in your GSTR-1 if required.`,
        "",
        `Your GSTIN: ${row.supplierGSTIN}`,
        "",
        "Regards,",
        closing,
      ].join("\n")
    }
    case "Tax Type Mismatch": {
      return [
        `Dear ${supplier},`,
        "",
        `Invoice ${row.invoiceNumber} shows IGST in GSTR-2B but our books have CGST+SGST (or vice versa).`,
        "",
        "Please verify the Place of Supply for this invoice and amend if required.",
        "",
        `Invoice No: ${row.invoiceNumber}`,
        `Your GSTIN: ${row.supplierGSTIN}`,
        "",
        "Regards,",
        closing,
      ].join("\n")
    }
    case "In 2B Only": {
      return [
        `Dear ${supplier},`,
        "",
        `Invoice ${row.invoiceNumber} dated ${row.invoiceDate} is appearing in our GSTR-2B but we have not recorded it in our books.`,
        "",
        `Taxable Value: ${formatINR(row.taxable2B)}`,
        "",
        "Please confirm if this invoice was genuinely issued to us.",
        "",
        `Your GSTIN: ${row.supplierGSTIN}`,
        "",
        "Regards,",
        closing,
      ].join("\n")
    }
    default: {
      return [
        `Dear ${supplier},`,
        "",
        `We are reconciling our GSTR-2B for ${periodLabel}.`,
        "",
        `Regarding invoice ${row.invoiceNumber} dated ${row.invoiceDate} (${row.status}):`,
        "",
        row.recommendedAction.trim() || "Please review and respond at the earliest.",
        "",
        `Your GSTIN: ${row.supplierGSTIN}`,
        "",
        "Regards,",
        closing,
      ].join("\n")
    }
  }
}

export function formatDiff(diff: number | null): {
  text: string
  isPositive: boolean
  isNegative: boolean
} {
  if (diff === null) {
    return { text: "—", isPositive: false, isNegative: false }
  }
  if (Math.abs(diff) <= 1) {
    return { text: "—", isPositive: false, isNegative: false }
  }
  const abs = Math.abs(diff)
  const formatted = abs.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })
  if (diff > 0) {
    return { text: `+${formatted}`, isPositive: true, isNegative: false }
  }
  return { text: `-${formatted}`, isPositive: false, isNegative: true }
}

export function normaliseGSTIN(gstin: string): string {
  return gstin.trim().toUpperCase()
}

export function normaliseInvoiceNo(inv: string): string {
  return inv.trim().toUpperCase().replace(/\s+/g, "")
}

export function makeMatchKey(gstin: string, invoiceNo: string): string {
  return `${normaliseGSTIN(gstin)}||${normaliseInvoiceNo(invoiceNo)}`
}

const requestIdSuffix = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  4,
)

export function generateRequestId(prefix: string): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${prefix}-${y}${m}${day}-${requestIdSuffix()}`
}

export function getMonthName(month: number): string {
  const names = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]
  return names[month - 1] ?? ""
}

export function getRiskSortOrder(risk: ITCRiskLevel): number {
  switch (risk) {
    case "Critical":
      return 0
    case "High":
      return 1
    case "Medium":
      return 2
    case "Safe":
    default:
      return 3
  }
}

/** Primary status ordering for reconciliation list (lower = earlier in list). */
export function getStatusSortPriority(status: MismatchStatus): number {
  switch (status) {
    case "Duplicate":
      return 1
    case "QRMP Delay":
      return 98
    case "In PR Only":
      return 5
    case "In 2B Only":
      return 6
    case "Value Mismatch":
      return 8
    case "Tax Type Mismatch":
      return 9
    case "Suggested Match":
      return 10
    case "RCM Invoice":
      return 11
    case "Matched":
      return 99
    default:
      return 50
  }
}

export function normaliseInvoiceForFuzzy(inv: string): string {
  return inv.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

export function fuzzyMatchScore(inv1: string, inv2: string): number {
  const n1 = normaliseInvoiceForFuzzy(inv1)
  const n2 = normaliseInvoiceForFuzzy(inv2)
  if (!n1 || !n2) return 0
  if (n1 === n2) return 100
  if (n1.includes(n2) || n2.includes(n1)) return 85
  if (n1.endsWith(n2) || n2.endsWith(n1)) return 80
  if (n1.startsWith(n2) || n2.startsWith(n1)) return 75
  return 0
}

export function buildSuggestedMatchReason(inv1: string, inv2: string, score: number): string {
  if (score === 100) {
    return "Invoice numbers match after removing special characters. Likely same invoice with formatting difference."
  }
  if (score === 85) {
    return "One invoice number contains the other. Possible prefix/suffix difference between your books and supplier filing."
  }
  return "Invoice numbers are similar. Verify if these are the same invoice."
}

/** Parse DD-MM-YYYY or YYYY-MM-DD invoice dates. */
export function parseInvoiceDateFlexible(s: string): Date | null {
  if (!s?.trim()) return null
  const t = s.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const dmy = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(t)
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export function getITCDeadlineInfo(invoiceDateStr: string): {
  deadline: Date
  deadlineStr: string
  daysRemaining: number
  isWarning: boolean
  isExpired: boolean
} | null {
  const d0 = parseInvoiceDateFlexible(invoiceDateStr)
  if (!d0) return null
  const month = d0.getMonth() + 1
  const year = d0.getFullYear()
  const fyEndYear = month >= 4 ? year + 1 : year
  const deadline = new Date(fyEndYear, 10, 30)
  const deadlineStr = deadline.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dline = new Date(deadline)
  dline.setHours(0, 0, 0, 0)
  const daysRemaining = Math.floor((dline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  return {
    deadline: dline,
    deadlineStr,
    daysRemaining,
    isExpired: daysRemaining < 0,
    isWarning: daysRemaining >= 0 && daysRemaining <= 60,
  }
}

export function parsePlaceOfSupplyState(pos: string): number | null {
  const n = Number.parseInt(String(pos ?? "").trim().slice(0, 2), 10)
  return Number.isFinite(n) ? n : null
}

export function validatePOS(
  b2b: { supplierGSTIN: string; placeOfSupply: string; igst: number; cgst: number; sgst: number },
  recipientGSTIN: string | undefined,
): { hasMismatch: boolean; warning: string | null } {
  if (!recipientGSTIN || recipientGSTIN.length < 2) {
    return { hasMismatch: false, warning: null }
  }
  const supplierState = Number.parseInt(b2b.supplierGSTIN.slice(0, 2), 10)
  const recipientState = Number.parseInt(recipientGSTIN.slice(0, 2), 10)
  const posState = parsePlaceOfSupplyState(b2b.placeOfSupply)
  if (!Number.isFinite(supplierState) || !Number.isFinite(recipientState) || posState === null) {
    return { hasMismatch: false, warning: null }
  }
  if (supplierState !== recipientState) {
    if (b2b.igst === 0 && (b2b.cgst > 0 || b2b.sgst > 0)) {
      return {
        hasMismatch: true,
        warning:
          "POS mismatch: interstate supply (supplier vs recipient state) but CGST/SGST is charged instead of IGST. ITC credit type may be incorrect.",
      }
    }
  } else {
    if (b2b.igst > 0 && b2b.cgst === 0 && b2b.sgst === 0) {
      return {
        hasMismatch: true,
        warning:
          "POS mismatch: intrastate supply but IGST is charged instead of CGST+SGST. Verify Place of Supply with supplier.",
      }
    }
  }
  return { hasMismatch: false, warning: null }
}

export function inferTaxRatePR(pr: {
  taxableValue: number
  igst: number
  cgst: number
  sgst: number
  taxRate?: number
}): number | null {
  if (pr.taxRate !== undefined && Number.isFinite(pr.taxRate)) return pr.taxRate
  if (pr.taxableValue <= 0) return null
  const tax = pr.igst + pr.cgst + pr.sgst
  return Math.round((tax / pr.taxableValue) * 1000) / 10
}

