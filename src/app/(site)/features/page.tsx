"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  Ban,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  Clock,
  Copy,
  FileQuestion,
  FileX,
  Fingerprint,
  IndianRupee,
  MapPin,
  PauseCircle,
  Percent,
  RefreshCw,
  ShieldAlert,
  ShieldOff,
} from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

type FeatureRisk = "Critical" | "High" | "Medium" | "Safe" | "Low"

const RISK_BADGE: Record<
  FeatureRisk,
  { className: string; label: string }
> = {
  Critical: {
    className: "bg-risk-critical-bg text-risk-critical",
    label: "Critical",
  },
  High: {
    className: "bg-risk-high-bg text-risk-high",
    label: "High",
  },
  Medium: {
    className: "bg-risk-medium-bg text-risk-medium",
    label: "Medium",
  },
  Safe: {
    className: "bg-risk-safe-bg text-risk-safe",
    label: "Safe",
  },
  Low: {
    className: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
    label: "Low",
  },
}

type ValidationCard = {
  title: string
  icon: LucideIcon
  iconClass: string
  risk: FeatureRisk
  checks: string
  why: string
}

const VALIDATION_CARDS: ValidationCard[] = [
  {
    title: "Exact Match Check",
    icon: CheckCircle2,
    iconClass: "text-emerald-600",
    risk: "Safe",
    checks:
      "Invoice exists in both GSTR-2B and Purchase Register with matching GSTIN, invoice number, and all tax values within ₹1.",
    why: "These invoices are safe to claim in GSTR-3B Table 4A(5). No action needed.",
  },
  {
    title: "Value Mismatch",
    icon: AlertTriangle,
    iconClass: "text-amber-600",
    risk: "Medium",
    checks:
      "Invoice found in both files but taxable value, IGST, CGST, or SGST differs by more than ₹1.",
    why: "Claiming excess ITC attracts DRC-01C notice from GSTN. Must claim only the lower of the two amounts.",
  },
  {
    title: "Tax Type Mismatch (IGST vs CGST+SGST)",
    icon: ArrowLeftRight,
    iconClass: "text-amber-600",
    risk: "Medium",
    checks:
      "Total tax amount is same in both files but one shows IGST and the other shows CGST+SGST.",
    why: "Wrong tax type indicates interstate vs intrastate classification error. Supplier must amend Place of Supply in GSTR-1.",
  },
  {
    title: "Missing from GSTR-2B (In PR Only)",
    icon: FileX,
    iconClass: "text-orange-600",
    risk: "High",
    checks:
      "Invoice recorded in your Purchase Register but not appearing in GSTR-2B — supplier has not filed or filed incorrectly.",
    why: "ITC cannot be claimed until invoice appears in GSTR-2B. Supplier must file or amend GSTR-1.",
  },
  {
    title: "Missing from Purchase Register (In 2B Only)",
    icon: FileQuestion,
    iconClass: "text-brand-blue",
    risk: "High",
    checks:
      "Invoice appears in GSTR-2B from your supplier but not recorded in your books.",
    why: "Either a genuine purchase not booked yet, or a supplier error. Verify before claiming.",
  },
  {
    title: "QRMP Supplier Detection",
    icon: Clock,
    iconClass: "text-brand-blue",
    risk: "Low",
    checks:
      "Detects suppliers filing under the Quarterly Return Monthly Payment (QRMP) scheme using the supprd field in GSTR-2B.",
    why: "QRMP supplier invoices appear in GSTR-2B after quarter end — not the same month. These are NOT missing invoices. No follow-up needed.",
  },
  {
    title: "ITC Blocked by GSTN (itcavl = N)",
    icon: Ban,
    iconClass: "text-red-600",
    risk: "Critical",
    checks: "GSTR-2B explicitly marks ITC as not available (itcavl = N field).",
    why: "ITC on this invoice must NOT be claimed regardless of what your books show. Includes Section 17(5) blocked credits.",
  },
  {
    title: "Section 17(5) Permanent Block (rsn = P)",
    icon: ShieldOff,
    iconClass: "text-red-600",
    risk: "Critical",
    checks:
      "GSTR-2B reason field shows P — permanent ineligibility under Section 17(5) of CGST Act.",
    why: "ITC is permanently blocked. Examples: motor vehicles, food and beverages, club memberships, personal use items.",
  },
  {
    title: "Conditional ITC Block (rsn = C)",
    icon: ShieldAlert,
    iconClass: "text-orange-600",
    risk: "High",
    checks: "GSTR-2B reason field shows C — ITC conditionally blocked.",
    why: "Specific conditions under GST rules are not met. Review with CA before deciding to claim.",
  },
  {
    title: "ITC Temporarily Unavailable (itcavl = T)",
    icon: PauseCircle,
    iconClass: "text-amber-600",
    risk: "Medium",
    checks: "GSTR-2B marks ITC as temporarily unavailable.",
    why: "ITC may become available in a subsequent period. Do not claim now — monitor next month's GSTR-2B.",
  },
  {
    title: "Section 16(4) Deadline Tracker",
    icon: CalendarClock,
    iconClass: "text-amber-600",
    risk: "High",
    checks:
      "Calculates the ITC claim deadline as 30th November of the financial year following the invoice date. Flags expired and near-expiry claims.",
    why: "ITC on invoices not appearing in GSTR-2B must be claimed before deadline or permanently lost. FY 2024-25 invoices → deadline 30 Nov 2025.",
  },
  {
    title: "Place of Supply (POS) Validation",
    icon: MapPin,
    iconClass: "text-amber-600",
    risk: "Medium",
    checks:
      "Checks whether the tax type (IGST for interstate, CGST+SGST for intrastate) is consistent with supplier state and recipient state.",
    why: "Wrong POS leads to incorrect ITC type in books. Claiming IGST when CGST+SGST applies (or vice versa) creates compliance issues.",
  },
  {
    title: "Duplicate Invoice Detection",
    icon: Copy,
    iconClass: "text-red-600",
    risk: "Critical",
    checks: "Detects the same invoice number appearing more than once in the same uploaded file.",
    why: "Duplicate invoices in your Purchase Register can lead to double-claiming ITC — a serious compliance violation attracting DRC-01C notice and penalties.",
  },
  {
    title: "Reverse Charge (RCM) Invoice Identification",
    icon: RefreshCw,
    iconClass: "text-amber-600",
    risk: "Medium",
    checks: "Identifies invoices where reverse charge is applicable (rev = Y in GSTR-2B).",
    why: "RCM invoices do NOT appear as claimable ITC in GSTR-2B. Tax must be paid by recipient directly and ITC claimed separately in GSTR-3B Table 4D.",
  },
  {
    title: "Suggested Match (Fuzzy Invoice Matching)",
    icon: Fingerprint,
    iconClass: "text-brand-blue",
    risk: "Medium",
    checks:
      "Identifies invoices that are likely the same despite different formatting — e.g. INV/2024/001 in books vs INV-2024-001 on portal. Confidence score 75-100%.",
    why: "Prevents false 'missing invoice' alerts caused purely by formatting differences between accounting software and GSTN portal.",
  },
  {
    title: "Tax Rate Mismatch",
    icon: Percent,
    iconClass: "text-amber-600",
    risk: "Medium",
    checks: "Compares the tax rate in GSTR-2B against the rate recorded in your Purchase Register.",
    why: "Different rates on same invoice may indicate HSN code misclassification. Verify correct rate with supplier.",
  },
  {
    title: "CESS Mismatch",
    icon: IndianRupee,
    iconClass: "text-amber-600",
    risk: "Low",
    checks:
      "Checks CESS amounts between GSTR-2B and Purchase Register. Relevant for tobacco, coal, pan masala, luxury goods.",
    why: "Incorrect CESS claim affects total ITC in GSTR-3B Table 4A(5) for applicable product categories.",
  },
  {
    title: "Period Timing Mismatch",
    icon: CalendarX,
    iconClass: "text-brand-blue",
    risk: "Medium",
    checks:
      "Detects invoices that are missing from the current month's GSTR-2B but the invoice date is recent — suggesting supplier filed late rather than not filing at all.",
    why: "Distinguishes between late filing (ITC expected next month) vs genuine non-filing (ITC needs immediate follow-up).",
  },
]

export default function FeaturesPage() {
  const { loading, isAuthenticated } = useAuth()

  return (
    <div className="bg-white">
      <section className="relative dot-grid-bg border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:py-16 md:px-6">
          <p className="mb-4 inline-flex rounded-full bg-brand-blue/10 px-3 py-1 text-xs font-semibold text-brand-blue">
            Version 1.0 — B2B Invoices
          </p>
          <h1 className="text-[32px] font-bold leading-tight text-brand-navy">
            What GSTRecon Reconciles For You
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-600">
            GSTRecon V1 is built specifically for B2B inward supply reconciliation between your GSTR-2B
            and Purchase Register. Here is exactly what it checks, validates, and flags — and what is
            coming in V2.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-16 px-4 py-14 sm:py-16 md:px-6">
        <section>
          <div className="flex justify-center">
            <div className="w-full max-w-xl rounded-xl border border-emerald-200 border-l-4 border-l-emerald-500 bg-[#F0FDF4] p-6 shadow-sm">
              <h2 className="text-lg font-bold text-emerald-900">✓ Covered in V1</h2>
              <ul className="mt-4 space-y-3 text-sm text-emerald-950">
                {[
                  "B2B Inward Supplies (regular invoices)",
                  "Invoices from registered suppliers",
                  "IGST / CGST / SGST amounts",
                  "CESS amounts",
                  "ITC availability status (Y / N / T)",
                  "Reverse charge invoices (RCM)",
                  "Place of Supply validation",
                  "Section 16(4) deadline tracking",
                  "QRMP supplier timing differences",
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-brand-navy">Every Validation GSTRecon Performs</h2>
          <p className="mt-2 max-w-2xl text-base text-slate-600">
            For each invoice in your GSTR-2B and Purchase Register, GSTRecon runs these checks
            automatically.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
            {VALIDATION_CARDS.map((card) => {
              const Icon = card.icon
              const risk = RISK_BADGE[card.risk]
              return (
                <div
                  key={card.title}
                  className="flex flex-col rounded-xl border border-border bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                        <Icon className={cn("h-5 w-5", card.iconClass)} aria-hidden />
                      </span>
                      <h3 className="font-semibold text-brand-navy">{card.title}</h3>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                        risk.className,
                      )}
                    >
                      {risk.label}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    <span className="font-medium text-slate-800">What it checks: </span>
                    {card.checks}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-medium text-slate-800">Why it matters: </span>
                    {card.why}
                  </p>
                </div>
              )
            })}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-brand-navy">How GSTRecon Matches Invoices</h2>
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-slate-50/80 p-6">
              <p className="text-sm font-semibold text-brand-navy">Step 1 — Normalise</p>
              <p className="mt-2 text-sm text-slate-600">
                Every GSTIN and invoice number is converted to UPPERCASE with all spaces removed before
                matching.
              </p>
              <div className="mt-3 rounded-lg bg-white p-3 font-mono text-xs text-slate-700 ring-1 ring-border">
                <p>&quot;27 aabcu 9603 r1zm&quot; → &quot;27AABCU9603R1ZM&quot;</p>
                <p className="mt-1">&quot;INV / 2024 / 001&quot; → &quot;INV/2024/001&quot;</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-slate-50/80 p-6">
              <p className="text-sm font-semibold text-brand-navy">Step 2 — Match Key</p>
              <p className="mt-2 text-sm text-slate-600">Each invoice gets a unique match key:</p>
              <div className="mt-3 rounded-lg bg-brand-navy px-4 py-3 font-mono text-sm text-white">
                <p>Match Key = GSTIN + &quot;||&quot; + Invoice Number</p>
                <p className="mt-2 text-brand-blue-lt">Example: 27AABCU9603R1ZM||INV/2024/001</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-slate-50/80 p-6">
              <p className="text-sm font-semibold text-brand-navy">Step 3 — Compare</p>
              <p className="mt-2 text-sm text-slate-600">
                If the match key exists in both files → compare values. If only in one file → flag as
                missing. ₹1 tolerance applied to handle rounding differences.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-brand-navy">ITC Risk Levels</h2>
          <p className="mt-2 text-base text-slate-600">
            Every invoice is assigned a risk level based on GST rules.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              {
                emoji: "🔴",
                title: "Critical",
                line: "Do NOT claim this ITC.",
                detail:
                  "ITC blocked by GSTN, Section 17(5) permanent block, duplicate invoice, Section 16(4) deadline expired.",
                border: "border-red-200 bg-red-50/80",
              },
              {
                emoji: "🟠",
                title: "High",
                line: "Immediate action required.",
                detail:
                  "Invoice missing from GSTR-2B, invoice missing from books, conditional ITC block, deadline expiring in under 60 days.",
                border: "border-orange-200 bg-orange-50/80",
              },
              {
                emoji: "🟡",
                title: "Medium",
                line: "Verify before filing GSTR-3B.",
                detail:
                  "Value mismatch, tax type mismatch, RCM invoice, POS issue, ITC temporarily unavailable.",
                border: "border-amber-200 bg-amber-50/80",
              },
              {
                emoji: "🟢",
                title: "Safe",
                line: "Safe to claim in GSTR-3B.",
                detail: "Fully matched invoice with ITC available (itcavl = Y).",
                border: "border-emerald-200 bg-emerald-50/80",
              },
            ].map((r) => (
              <div key={r.title} className={cn("rounded-xl border p-5", r.border)}>
                <p className="text-lg font-bold text-brand-navy">
                  {r.emoji} {r.title}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-800">{r.line}</p>
                <p className="mt-2 text-xs text-slate-600">{r.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-brand-navy">GSTR-3B Ready Output</h2>
          <div className="mt-6 rounded-xl border border-brand-blue/30 bg-[#EFF6FF] p-6 text-slate-700">
            <p className="text-sm font-medium text-brand-navy">
              After reconciliation GSTRecon tells you exactly what to enter in your GSTR-3B filing:
            </p>
            <ul className="mt-4 space-y-4 text-sm">
              <li>
                <span className="font-semibold text-brand-navy">Table 4A(5) — All other ITC:</span>
                <span className="mt-1 block text-slate-600">
                  → Sum of all Matched invoices (IGST / CGST / SGST)
                </span>
              </li>
              <li>
                <span className="font-semibold text-brand-navy">Table 4D(1) — Ineligible ITC:</span>
                <span className="mt-1 block text-slate-600">
                  → Sum of all blocked invoices (itcavl = N)
                </span>
              </li>
              <li>
                <span className="font-semibold text-brand-navy">Deferred ITC:</span>
                <span className="mt-1 block text-slate-600">
                  → Invoices missing from GSTR-2B (claim when supplier files)
                </span>
                <span className="mt-1 block text-slate-600">
                  → QRMP supplier invoices (claim in next quarter)
                </span>
              </li>
            </ul>
          </div>
        </section>

        <section className="border-t border-border pt-12 text-center">
          <h2 className="text-xl font-bold text-brand-navy">Ready to reconcile your GSTR-2B?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            Upload your files and get results in 60 seconds.
          </p>
          <div className="mt-6 flex justify-center">
            {loading ? (
              <div className="h-10 w-40 animate-pulse rounded-lg bg-muted" aria-hidden />
            ) : isAuthenticated ? (
              <Link
                href="/dashboard"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "inline-flex items-center gap-2 bg-brand-blue text-white hover:bg-brand-blue/90",
                )}
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : (
              <Link
                href="/reconcile"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "inline-flex items-center gap-2 bg-brand-blue text-white hover:bg-brand-blue/90",
                )}
              >
                Start Reconciling
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
