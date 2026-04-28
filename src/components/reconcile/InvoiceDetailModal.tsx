"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import { Copy, X } from "lucide-react"

import { ActionBadge } from "@/components/reconcile/ActionBadge"
import { RiskBadge } from "@/components/reconcile/RiskBadge"
import { StatusBadge } from "@/components/reconcile/StatusBadge"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { cn, formatINR, generateVendorMessage } from "@/lib/utils"
import type { ReconciliationRow, VendorMessageContext } from "@/lib/types"

function explanationForRow(row: ReconciliationRow): string {
  switch (row.status) {
    case "Value Mismatch":
      return "The taxable value or tax amounts differ between what your supplier filed in GSTR-1 (shown in GSTR-2B) and what is recorded in your Purchase Register."
    case "Tax Type Mismatch":
      return "The total tax amount is the same in both files but the tax type differs — one shows IGST while the other shows CGST+SGST. This indicates an interstate vs intrastate classification error."
    case "In PR Only":
      return "This invoice is in your Purchase Register but does NOT appear in your GSTR-2B. Your supplier has not filed this invoice in their GSTR-1. You cannot claim ITC until it appears in GSTR-2B."
    case "In 2B Only":
      return "This invoice appears in your GSTR-2B but is not recorded in your Purchase Register. Verify if this is a genuine purchase and add it to your books."
    case "ITC Blocked":
      return row.itcBlockReason === "permanent"
        ? "ITC is permanently blocked under Section 17(5) of the CGST Act. This type of purchase (motor vehicles, food, personal use items etc.) is not eligible for ITC under any circumstances."
        : "ITC is conditionally blocked. Specific conditions under GST rules are not met. Review with your CA before deciding to claim."
    case "Duplicate":
      return "This invoice number appears more than once in your GSTR-2B. Claiming ITC twice on the same invoice is a serious compliance violation and attracts DRC-01C notice."
    case "RCM Invoice":
      return "This is a Reverse Charge invoice. You must pay GST directly to the government (not the supplier). Enter in GSTR-3B Table 3.1(d) and claim ITC back in Table 4D — not in Table 4A(5)."
    case "QRMP Delay":
      return "This supplier files returns quarterly under the QRMP scheme. This invoice will appear in the next quarter's GSTR-2B. No action needed — monitor next quarter."
    case "Suggested Match":
      return "Invoice numbers are similar but formatted differently (e.g. slashes vs dashes). Verify these are the same invoice. If confirmed, update the format in your books to match the supplier's filing."
    case "POS Mismatch":
      return "The Place of Supply or tax type does not match the supplier-recipient state combination. An interstate supply should use IGST; intrastate should use CGST+SGST."
    case "Tax Rate Mismatch":
      return "The tax rate used by the supplier in their GSTR-1 differs from what is recorded in your books. Verify the correct HSN code and applicable rate."
    case "CESS Mismatch":
      return "The CESS amount differs between GSTR-2B and your Purchase Register. Verify the correct CESS rate for the HSN code of this product."
    case "ITC Temporary":
      return "ITC is temporarily unavailable as marked by GSTN (itcavl=T). This may be because the supplier has outstanding GST dues. Do not claim now — check next month's GSTR-2B."
    default:
      return row.recommendedAction || "Review this invoice carefully before filing."
  }
}

function riskAlertClass(row: ReconciliationRow) {
  if (row.itcRisk === "Critical") return "border-red-200 border-l-red-600 bg-red-50"
  if (row.itcRisk === "High") return "border-orange-200 border-l-orange-500 bg-orange-50"
  if (row.itcRisk === "Medium") return "border-amber-200 border-l-amber-500 bg-amber-50"
  return "border-emerald-200 border-l-emerald-500 bg-emerald-50"
}

function toNumber(v: number | null | undefined) {
  return v ?? 0
}

function absDiff(a: number | null | undefined, b: number | null | undefined) {
  return Math.abs(toNumber(a) - toNumber(b))
}

function stateNameFromCode(code: string) {
  const map: Record<string, string> = {
    "01": "Jammu and Kashmir",
    "02": "Himachal Pradesh",
    "03": "Punjab",
    "04": "Chandigarh",
    "05": "Uttarakhand",
    "06": "Haryana",
    "07": "Delhi",
    "08": "Rajasthan",
    "09": "Uttar Pradesh",
    "10": "Bihar",
    "11": "Sikkim",
    "12": "Arunachal Pradesh",
    "13": "Nagaland",
    "14": "Manipur",
    "15": "Mizoram",
    "16": "Tripura",
    "17": "Meghalaya",
    "18": "Assam",
    "19": "West Bengal",
    "20": "Jharkhand",
    "21": "Odisha",
    "22": "Chhattisgarh",
    "23": "Madhya Pradesh",
    "24": "Gujarat",
    "27": "Maharashtra",
    "29": "Karnataka",
    "30": "Goa",
    "32": "Kerala",
    "33": "Tamil Nadu",
    "34": "Puducherry",
    "36": "Telangana",
    "37": "Andhra Pradesh",
  }
  return map[code] ?? "Unknown"
}

function DataPointRow({
  icon,
  label,
  value2B,
  valuePR,
  diff,
  isMatch,
}: {
  icon: string
  label: string
  value2B: string
  valuePR: string
  diff?: string
  isMatch: boolean
}) {
  return (
    <div className={cn("rounded-md border p-3", isMatch ? "border-slate-200 bg-slate-50/60" : "border-red-200 bg-red-50/60")}>
      <p className="text-sm font-semibold text-slate-800">{icon} {label}</p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-slate-500">GSTR-2B</p>
          <p className={cn("font-medium", isMatch ? "text-slate-600" : "text-red-700")}>{value2B}</p>
        </div>
        <div>
          <p className="text-slate-500">Your Books</p>
          <p className={cn("font-medium", isMatch ? "text-slate-600" : "text-red-700")}>{valuePR}</p>
        </div>
        <div>
          <p className="text-slate-500">Diff</p>
          <p className={cn("font-semibold", isMatch ? "text-slate-500" : "text-red-700")}>{isMatch ? "✓" : (diff ?? "—")}</p>
        </div>
      </div>
    </div>
  )
}

type CompareItem = {
  field: string
  left: ReactNode
  right: ReactNode
  mismatch: boolean
}

function fmtNum(value: number | null | undefined) {
  return formatINR(value ?? null)
}

function itcPill(value: string | null | undefined) {
  if (value === "Y") {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
        Available ✓
      </span>
    )
  }
  if (value === "N") {
    return (
      <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700">
        Blocked ✗
      </span>
    )
  }
  if (value === "T") {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
        Temporary ⏸
      </span>
    )
  }
  return "—"
}

function describeInvoiceDiff(raw2B: string, rawPR: string): string {
  if (raw2B === rawPR) return "Invoice numbers are identical"
  if (raw2B.replace(/\//g, "-") === rawPR || rawPR.replace(/\//g, "-") === raw2B) {
    return '"/" replaced with "-" (slash vs dash)'
  }
  if (raw2B.replace(/\s/g, "") === rawPR.replace(/\s/g, "")) {
    return "Spaces removed or added"
  }
  const n2B = raw2B.replace(/[^A-Z0-9]/gi, "").toUpperCase()
  const nPR = rawPR.replace(/[^A-Z0-9]/gi, "").toUpperCase()
  if (n2B.includes(nPR) || nPR.includes(n2B)) {
    return "One invoice number contains the other (possible prefix/suffix difference)"
  }
  return "Formatting difference after removing special characters"
}

function confidenceStyle(confidence: number) {
  if (confidence >= 90) return "bg-emerald-500"
  if (confidence >= 80) return "bg-blue-500"
  return "bg-amber-500"
}

function buildComparisonRows(row: ReconciliationRow): CompareItem[] {
  const raw2B = row.rawInvoiceNumber2B ?? row.invoiceNumber ?? "—"
  const rawPR = row.rawInvoiceNumberPR ?? row.invoiceNumber ?? "—"
  const isSuggested = row.status === "Suggested Match"
  const rows: CompareItem[] = []
  rows.push(
    {
      field: "Invoice Number",
      left: raw2B,
      right: rawPR,
      mismatch: !isSuggested && raw2B !== rawPR,
    },
    { field: "Invoice Date", left: row.invoiceDate || "—", right: row.invoiceDate || "—", mismatch: false },
    {
      field: "Taxable Value",
      left: fmtNum(row.taxable2B),
      right: fmtNum(row.taxablePR),
      mismatch: absDiff(row.taxable2B, row.taxablePR) > 1,
    },
    {
      field: "IGST",
      left: fmtNum(row.igst2B),
      right: fmtNum(row.igstPR),
      mismatch: absDiff(row.igst2B, row.igstPR) > 1,
    },
    {
      field: "CGST",
      left: fmtNum(row.cgst2B),
      right: fmtNum(row.cgstPR),
      mismatch: absDiff(row.cgst2B, row.cgstPR) > 1,
    },
    {
      field: "SGST",
      left: fmtNum(row.sgst2B),
      right: fmtNum(row.sgstPR),
      mismatch: absDiff(row.sgst2B, row.sgstPR) > 1,
    },
  )
  const cess2B = (row.cessDiff ?? 0) > 0 ? Math.abs(row.cessDiff ?? 0) : 0
  const cessPR = (row.cessDiff ?? 0) < 0 ? Math.abs(row.cessDiff ?? 0) : 0
  if (cess2B > 0 || cessPR > 0) {
    rows.push({
      field: "CESS",
      left: fmtNum(cess2B),
      right: fmtNum(cessPR),
      mismatch: Math.abs(cess2B - cessPR) > 1,
    })
  }
  rows.push(
    {
      field: "Total Tax",
      left: fmtNum((row.igst2B ?? 0) + (row.cgst2B ?? 0) + (row.sgst2B ?? 0)),
      right: fmtNum((row.igstPR ?? 0) + (row.cgstPR ?? 0) + (row.sgstPR ?? 0)),
      mismatch:
        (row.igst2B ?? 0) + (row.cgst2B ?? 0) + (row.sgst2B ?? 0) !==
        (row.igstPR ?? 0) + (row.cgstPR ?? 0) + (row.sgstPR ?? 0),
    },
    {
      field: "ITC Available",
      left: itcPill(row.itcAvailable),
      right: "—",
      mismatch: false,
    },
    {
      field: "Place of Supply",
      left: row.placeOfSupply || "—",
      right: "—",
      mismatch: false,
    },
  )
  if (row.taxRate2B != null || row.taxRatePR != null) {
    rows.splice(rows.length - 1, 0, {
      field: "Tax Rate",
      left: row.taxRate2B != null ? `${row.taxRate2B}%` : "—",
      right: row.taxRatePR != null ? `${row.taxRatePR}%` : "—",
      mismatch: row.taxRate2B != null && row.taxRatePR != null && absDiff(row.taxRate2B, row.taxRatePR) > 0.1,
    })
  }
  return rows
}

export function InvoiceDetailModal({
  row,
  allRows,
  isOpen,
  onClose,
  onNavigate,
  currentIndex,
  vendorMessage,
}: {
  row: ReconciliationRow | null
  allRows: ReconciliationRow[]
  isOpen: boolean
  onClose: () => void
  onNavigate: (direction: "prev" | "next") => void
  currentIndex: number
  vendorMessage?: VendorMessageContext
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [isOpen, onClose])

  const compareRows = useMemo(() => (row ? buildComparisonRows(row) : []), [row])
  const canPrev = currentIndex > 0
  const canNext = currentIndex < allRows.length - 1
  const canCopy = row && row.status !== "Matched" && row.status !== "QRMP Delay" && row.itcRisk !== "Safe"
  const totalTax2B = toNumber(row?.igst2B) + toNumber(row?.cgst2B) + toNumber(row?.sgst2B)
  const totalTaxPR = toNumber(row?.igstPR) + toNumber(row?.cgstPR) + toNumber(row?.sgstPR)
  const suggestedConfidence = row?.matchConfidence ?? 0
  const rawInv2B = row?.rawInvoiceNumber2B ?? row?.invoiceNumber ?? "—"
  const rawInvPR = row?.rawInvoiceNumberPR ?? row?.invoiceNumber ?? "—"
  const normInv2B = row?.normalisedInvoiceNumber2B ?? "—"
  const normInvPR = row?.normalisedInvoiceNumberPR ?? "—"

  if (!row) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="inset-0 h-[100dvh] max-h-[100dvh] w-full max-w-none overflow-y-auto rounded-none p-0 md:inset-auto md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-xl">
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            className="absolute top-3 right-3 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
          <div className="flex items-start gap-2">
            <RiskBadge row={row} />
            <StatusBadge status={row.status} />
          </div>
          <p className="mt-3 text-lg font-bold text-brand-navy">{row.supplierName}</p>
          <p className="font-mono text-sm text-slate-500">{row.invoiceNumber}</p>
          <p className="text-xs text-slate-500">{row.invoiceDate} · {row.placeOfSupply || "—"}</p>
        </div>

        <div className="space-y-5 px-5 py-4">
          <section>
            <h3 className="text-sm font-semibold text-brand-navy">Why This Is Flagged</h3>
            <div className={cn("mt-2 rounded-md border border-l-4 p-3 text-sm leading-relaxed", riskAlertClass(row))}>
              {explanationForRow(row)}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-brand-navy">What Triggered This Flag</h3>
            <div className="mt-2 space-y-2">
              {row.status === "Value Mismatch" ? (
                <>
                  <p className="text-xs font-semibold text-slate-600">Mismatching Fields Detected</p>
                  {absDiff(row.taxable2B, row.taxablePR) > 1 ? (
                    <DataPointRow
                      icon="🔴"
                      label="Taxable Value"
                      value2B={formatINR(row.taxable2B)}
                      valuePR={formatINR(row.taxablePR)}
                      diff={formatINR(absDiff(row.taxable2B, row.taxablePR))}
                      isMatch={false}
                    />
                  ) : null}
                  {absDiff(row.igst2B, row.igstPR) > 1 ? (
                    <DataPointRow
                      icon="🔴"
                      label="IGST Amount"
                      value2B={formatINR(row.igst2B)}
                      valuePR={formatINR(row.igstPR)}
                      diff={formatINR(absDiff(row.igst2B, row.igstPR))}
                      isMatch={false}
                    />
                  ) : null}
                  {absDiff(row.cgst2B, row.cgstPR) > 1 ? (
                    <DataPointRow
                      icon="🔴"
                      label="CGST Amount"
                      value2B={formatINR(row.cgst2B)}
                      valuePR={formatINR(row.cgstPR)}
                      diff={formatINR(absDiff(row.cgst2B, row.cgstPR))}
                      isMatch={false}
                    />
                  ) : null}
                  {absDiff(row.sgst2B, row.sgstPR) > 1 ? (
                    <DataPointRow
                      icon="🔴"
                      label="SGST Amount"
                      value2B={formatINR(row.sgst2B)}
                      valuePR={formatINR(row.sgstPR)}
                      diff={formatINR(absDiff(row.sgst2B, row.sgstPR))}
                      isMatch={false}
                    />
                  ) : null}
                </>
              ) : null}

              {row.status === "Tax Type Mismatch" ? (
                <>
                  <p className="text-xs font-semibold text-slate-600">Tax Type Conflict</p>
                  <DataPointRow
                    icon="🟡"
                    label="Total Tax (same in both)"
                    value2B={formatINR(totalTax2B)}
                    valuePR={formatINR(totalTaxPR)}
                    diff={formatINR(absDiff(totalTax2B, totalTaxPR))}
                    isMatch={absDiff(totalTax2B, totalTaxPR) <= 1}
                  />
                  <DataPointRow icon="🔴" label="IGST" value2B={formatINR(row.igst2B)} valuePR={formatINR(row.igstPR)} diff={formatINR(absDiff(row.igst2B, row.igstPR))} isMatch={absDiff(row.igst2B, row.igstPR) <= 1} />
                  <DataPointRow icon="🔴" label="CGST" value2B={formatINR(row.cgst2B)} valuePR={formatINR(row.cgstPR)} diff={formatINR(absDiff(row.cgst2B, row.cgstPR))} isMatch={absDiff(row.cgst2B, row.cgstPR) <= 1} />
                  <DataPointRow icon="🔴" label="SGST" value2B={formatINR(row.sgst2B)} valuePR={formatINR(row.sgstPR)} diff={formatINR(absDiff(row.sgst2B, row.sgstPR))} isMatch={absDiff(row.sgst2B, row.sgstPR) <= 1} />
                  <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">
                    Total tax matches ({formatINR(totalTax2B)}) but GSTR-2B shows IGST while your books show CGST+SGST.
                  </p>
                </>
              ) : null}

              {row.status === "In PR Only" ? (
                <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-700 space-y-1.5">
                  <p className="font-semibold">Why It's Missing From GSTR-2B</p>
                  <p>🔴 Invoice NOT found in GSTR-2B using match key: <span className="font-mono">{row.supplierGSTIN} + {row.invoiceNumber}</span></p>
                  <p>📋 In your books: GSTIN {row.supplierGSTIN}, Invoice {row.invoiceNumber}, Date {row.invoiceDate}, Taxable {formatINR(row.taxablePR)}</p>
                  {row.isTimingMismatch ? <p>📅 Timing note: {row.timingNote ?? "Invoice is from a different filing period; supplier may have filed late."}</p> : null}
                </div>
              ) : null}

              {row.status === "In 2B Only" ? (
                <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-700 space-y-1.5">
                  <p className="font-semibold">Why It's Not In Your Books</p>
                  <p>🔵 Found in GSTR-2B: GSTIN {row.supplierGSTIN}, Invoice {row.invoiceNumber}, Date {row.invoiceDate}, Taxable {formatINR(row.taxable2B)}, ITC Available {row.itcAvailable ?? "—"}</p>
                  <p>🔍 Search in your books using match key <span className="font-mono">{row.supplierGSTIN} + {row.invoiceNumber}</span> returned no match.</p>
                </div>
              ) : null}

              {row.status === "ITC Blocked" ? (
                <div className="rounded-md border border-red-200 bg-red-50/70 p-3 text-xs text-red-900 space-y-1.5">
                  <p className="font-semibold">GSTR-2B Block Details</p>
                  <p>🔴 ITC Available (itcavl): <span className="rounded bg-red-100 px-1 py-0.5 font-semibold">N</span></p>
                  <p>🔴 Block Reason (rsn): <span className="font-semibold">{row.itcBlockReason === "permanent" ? "P (Permanent)" : "C (Conditional)"}</span></p>
                  {row.itcBlockReason === "permanent" ? (
                    <p>Common Section 17(5) items: motor vehicles, food/beverages, club memberships, employee travel benefits, works contract, personal-use goods/services.</p>
                  ) : (
                    <p>Specific GST conditions are not satisfied for this invoice. Review with your CA before claiming.</p>
                  )}
                </div>
              ) : null}

              {row.status === "ITC Temporary" ? (
                <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 space-y-1.5">
                  <p className="font-semibold">Temporary Hold Details</p>
                  <p>🟡 ITC Available (itcavl): <span className="rounded bg-amber-100 px-1 py-0.5 font-semibold">T</span></p>
                  <p>📋 Supplier {row.supplierName} ({row.supplierGSTIN}), Invoice {row.invoiceNumber}, Tax on hold {formatINR(totalTax2B)}</p>
                  <p>Most common reason: supplier has outstanding GST dues and GSTN keeps ITC on temporary hold.</p>
                </div>
              ) : null}

              {row.status === "RCM Invoice" ? (
                <div className="rounded-md border border-violet-200 bg-violet-50/70 p-3 text-xs text-violet-900 space-y-1.5">
                  <p className="font-semibold">What Triggered RCM Flag</p>
                  <p>🔄 Reverse Charge field (rev) in GSTR-2B is marked as <span className="rounded bg-violet-100 px-1 py-0.5 font-semibold">Y</span>.</p>
                  <p>📋 GSTIN {row.supplierGSTIN}, Taxable {formatINR(row.taxable2B)}, Tax Amount {formatINR(totalTax2B)}.</p>
                  <p>Step 1: Pay {formatINR(totalTax2B)} in GSTR-3B Table 3.1(d). Step 2: Claim {formatINR(totalTax2B)} in Table 4D.</p>
                </div>
              ) : null}

              {row.status === "Duplicate" ? (
                <div className="rounded-md border border-red-200 bg-red-50/70 p-3 text-xs text-red-900 space-y-1.5">
                  <p className="font-semibold">Duplicate Detection Details</p>
                  <p>🔴 Match key: GSTIN <span className="font-mono">{row.supplierGSTIN}</span> + Invoice <span className="font-mono">{row.invoiceNumber}</span> = <span className="font-mono">{row.matchKey}</span></p>
                  <p>This exact combination appears multiple times in GSTR-2B and can lead to double ITC claim of {formatINR(totalTax2B)}.</p>
                </div>
              ) : null}

              {row.status === "QRMP Delay" ? (
                <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-700 space-y-1.5">
                  <p className="font-semibold">Why This Is QRMP</p>
                  <p>🕐 Supplier is tagged as quarterly filer (QRMP). {row.qrmpNote ?? "Invoice may appear in subsequent quarter statement."}</p>
                  <p>✅ No action needed. Monitor next quarter's GSTR-2B for this invoice.</p>
                </div>
              ) : null}

              {row.status === "Suggested Match" ? (
                <div className="rounded-md border border-sky-200 bg-sky-50/70 p-3 text-xs text-sky-900 space-y-1.5">
                  <p className="font-semibold">Why a Match Was Suggested</p>
                  <p>🔍 Invoice Number Comparison</p>
                  <div className="space-y-2 rounded-md border border-sky-200 bg-white/70 p-2">
                    <p>In GSTR-2B (original): <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{rawInv2B}</span></p>
                    <p>In Your Books (original): <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono">{rawInvPR}</span></p>
                    <p>After removing special characters:</p>
                    <p className="font-mono text-slate-700">2B: {normInv2B}</p>
                    <p className="font-mono text-slate-700">PR: {normInvPR}</p>
                    <p>Match confidence: {suggestedConfidence}%</p>
                    <div className="h-2 w-full rounded bg-slate-200">
                      <div
                        className={cn("h-2 rounded", confidenceStyle(suggestedConfidence))}
                        style={{ width: `${Math.max(0, Math.min(100, suggestedConfidence))}%` }}
                      />
                    </div>
                    <p>Difference detected: {describeInvoiceDiff(rawInv2B, rawInvPR)}</p>
                  </div>
                </div>
              ) : null}

              {row.status === "POS Mismatch" ? (
                <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 space-y-1.5">
                  <p className="font-semibold">Place of Supply Analysis</p>
                  <p>🗺️ Supplier GSTIN {row.supplierGSTIN} → state code {row.supplierGSTIN.slice(0, 2)} ({stateNameFromCode(row.supplierGSTIN.slice(0, 2))})</p>
                  <p>🗺️ Recipient state is not available on this row payload. POS field in 2B: {row.placeOfSupply || "—"}</p>
                  <p>Found tax split: IGST {formatINR(row.igst2B)}, CGST {formatINR(row.cgst2B)}, SGST {formatINR(row.sgst2B)}. Verify interstate vs intrastate treatment.</p>
                </div>
              ) : null}

              {row.status === "Tax Rate Mismatch" ? (
                <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 space-y-1.5">
                  <p className="font-semibold">Tax Rate Discrepancy</p>
                  <p>📊 GSTR-2B rate: {row.taxRate2B != null ? `${row.taxRate2B}%` : "—"} · Your books: {row.taxRatePR != null ? `${row.taxRatePR}%` : "—"}</p>
                  <p>🔴 Tax difference: {formatINR(absDiff(totalTax2B, totalTaxPR))}</p>
                  <p>Verify the applicable HSN-based rate on GST portal.</p>
                </div>
              ) : null}

              {row.status === "CESS Mismatch" ? (
                <div className="rounded-md border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 space-y-1.5">
                  <p className="font-semibold">CESS Amount Discrepancy</p>
                  <p>💰 CESS in GSTR-2B: {formatINR((row.cessDiff ?? 0) > 0 ? Math.abs(row.cessDiff ?? 0) : 0)}</p>
                  <p>💰 CESS in your books: {formatINR((row.cessDiff ?? 0) < 0 ? Math.abs(row.cessDiff ?? 0) : 0)}</p>
                  <p>🔴 Difference: {formatINR(Math.abs(row.cessDiff ?? 0))}</p>
                </div>
              ) : null}

              {row.status === "Matched" ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 space-y-1.5">
                  <p className="font-semibold">All Fields Verified ✓</p>
                  <DataPointRow icon="✅" label="Taxable Value" value2B={formatINR(row.taxable2B)} valuePR={formatINR(row.taxablePR)} isMatch={absDiff(row.taxable2B, row.taxablePR) <= 1} />
                  <DataPointRow icon="✅" label="IGST" value2B={formatINR(row.igst2B)} valuePR={formatINR(row.igstPR)} isMatch={absDiff(row.igst2B, row.igstPR) <= 1} />
                  <DataPointRow icon="✅" label="CGST" value2B={formatINR(row.cgst2B)} valuePR={formatINR(row.cgstPR)} isMatch={absDiff(row.cgst2B, row.cgstPR) <= 1} />
                  <DataPointRow icon="✅" label="SGST" value2B={formatINR(row.sgst2B)} valuePR={formatINR(row.sgstPR)} isMatch={absDiff(row.sgst2B, row.sgstPR) <= 1} />
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-brand-navy">Invoice Data Comparison</h3>
            <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Field</th>
                    <th className="px-3 py-2 text-left font-semibold">GSTR-2B</th>
                    <th className="px-3 py-2 text-left font-semibold">Your Books (PR)</th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((item) => (
                    <tr key={item.field} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-600">{item.field}</td>
                      <td
                        className={cn(
                          "px-3 py-2",
                          item.mismatch && "bg-red-50 font-medium text-red-700",
                          row.status === "Suggested Match" &&
                            item.field === "Invoice Number" &&
                            "bg-amber-50 font-medium text-amber-700",
                        )}
                      >
                        {item.left}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2",
                          item.mismatch && "bg-red-50 font-medium text-red-700",
                          row.status === "Suggested Match" &&
                            item.field === "Invoice Number" &&
                            "bg-amber-50 font-medium text-amber-700",
                        )}
                      >
                        {item.right}
                      </td>
                    </tr>
                  ))}
                  {row.status === "Suggested Match" ? (
                    <tr className="border-t border-slate-100">
                      <td className="px-3 py-2 text-xs text-slate-400" colSpan={3}>
                        After normalisation: both resolve to {normInv2B || normInvPR || "—"}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-brand-navy">What To Do</h3>
            <div className="mt-2 rounded-md border border-slate-200 border-l-4 border-l-blue-500 bg-white p-3 text-sm leading-relaxed">
              {row.recommendedAction}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold">Urgency:</span>
              <ActionBadge urgency={row.actionUrgency} />
              <span className="ml-2 font-semibold">ITC Claim Deadline:</span>
              <span>
                {row.isDeadlineExpired ? "EXPIRED" : row.itcClaimDeadline || "—"}
              </span>
            </div>
          </section>

          {canCopy ? (
            <section>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium",
                  copied ? "text-emerald-600" : "text-slate-700 hover:bg-slate-50",
                )}
                onClick={async () => {
                  const text = generateVendorMessage(
                    row,
                    vendorMessage?.period?.trim() || "the relevant return period",
                    vendorMessage?.caName,
                  )
                  try {
                    await navigator.clipboard.writeText(text)
                    setCopied(true)
                    window.setTimeout(() => setCopied(false), 2000)
                  } catch {
                    // Clipboard may be unavailable.
                  }
                }}
              >
                <Copy className="h-4 w-4" aria-hidden />
                {copied ? "✓ Copied!" : "Copy Message for Supplier"}
              </button>
            </section>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between border-t border-slate-200 bg-white px-5 py-3">
          <p className="text-xs text-slate-400">
            Invoice {allRows.length === 0 ? 0 : currentIndex + 1} of {allRows.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => onNavigate("prev")}
              className={cn(
                "rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700",
                !canPrev && "opacity-40",
              )}
            >
              ← Previous
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => onNavigate("next")}
              className={cn(
                "rounded border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700",
                !canNext && "opacity-40",
              )}
            >
              Next →
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
