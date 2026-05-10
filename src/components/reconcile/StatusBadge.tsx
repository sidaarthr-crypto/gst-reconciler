import { buildStatusSegments } from "@/components/reconcile/badge-display"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { MismatchStatus, ReconciliationRow } from "@/lib/types"

const map: Record<
  MismatchStatus,
  { className: string }
> = {
  Matched: {
    className:
      "border-emerald-500/60 bg-transparent text-emerald-700 hover:bg-emerald-50",
  },
  "Sec 16(4) Expired": {
    className:
      "border-red-600/80 bg-transparent text-red-900 hover:bg-red-50",
  },
  "Value Mismatch": {
    className:
      "border-amber-500/60 bg-transparent text-amber-800 hover:bg-amber-50",
  },
  "Tax Type Mismatch": {
    className:
      "border-amber-600/60 bg-transparent text-amber-900 hover:bg-amber-50",
  },
  "Suggested Match": {
    className:
      "border-sky-500/60 bg-transparent text-sky-900 hover:bg-sky-50",
  },
  "In 2B Only": {
    className:
      "border-blue-500/60 bg-transparent text-blue-800 hover:bg-blue-50",
  },
  "In PR Only": {
    className:
      "border-orange-500/60 bg-transparent text-orange-800 hover:bg-orange-50",
  },
  "Period Timing Mismatch": {
    className:
      "border-sky-500/60 bg-transparent text-sky-900 hover:bg-sky-50",
  },
  "QRMP Delay": {
    className:
      "border-slate-400/60 bg-transparent text-slate-700 hover:bg-slate-100",
  },
  Duplicate: {
    className:
      "border-red-600/70 bg-transparent text-red-800 hover:bg-red-50",
  },
  "RCM Invoice": {
    className:
      "border-violet-500/60 bg-transparent text-violet-900 hover:bg-violet-50",
  },
  "ITC Blocked": {
    className:
      "border-red-700/70 bg-transparent text-red-900 hover:bg-red-50",
  },
  "ITC Temporary": {
    className:
      "border-amber-600/60 bg-transparent text-amber-900 hover:bg-amber-50",
  },
  "POS Mismatch": {
    className:
      "border-amber-500/60 bg-transparent text-amber-900 hover:bg-amber-50",
  },
  "CESS Mismatch": {
    className:
      "border-amber-500/60 bg-transparent text-amber-800 hover:bg-amber-50",
  },
  "Tax Rate Mismatch": {
    className:
      "border-amber-500/60 bg-transparent text-amber-900 hover:bg-amber-50",
  },
  "Date Gap Match": {
    className:
      "border-emerald-500/60 bg-transparent text-emerald-700 hover:bg-emerald-50",
  },
  "Group Entity Match": {
    className:
      "border-emerald-500/60 bg-transparent text-emerald-700 hover:bg-emerald-50",
  },
  "GSTIN Mismatch Match": {
    className:
      "border-amber-500/60 bg-transparent text-amber-800 hover:bg-amber-50",
  },
  "Amount-Led Match": {
    className:
      "border-amber-500/60 bg-transparent text-amber-800 hover:bg-amber-50",
  },
  "Consolidated Invoice Match": {
    className:
      "border-emerald-500/60 bg-transparent text-emerald-700 hover:bg-emerald-50",
  },
  "Probable Month Match": {
    className:
      "border-amber-500/60 bg-transparent text-amber-800 hover:bg-amber-50",
  },
  "Unclaimed ITC": {
    className:
      "border-orange-500/60 bg-transparent text-orange-900 hover:bg-orange-50",
  },
  "ITC Eligibility Uncertain": {
    className:
      "border-amber-500/60 bg-transparent text-amber-900 hover:bg-amber-50",
  },
  "Debit Note Misclassified": {
    className:
      "border-red-600/70 bg-transparent text-red-800 hover:bg-red-50",
  },
  "Partially Booked ITC": {
    className:
      "border-amber-500/60 bg-transparent text-amber-800 hover:bg-amber-50",
  },
  "ITC Reduced by Supplier": {
    className:
      "border-amber-500/60 bg-transparent text-amber-800 hover:bg-amber-50",
  },
  "Non-GST Entry": {
    className:
      "border-slate-400/60 bg-transparent text-slate-600 hover:bg-slate-100",
  },
}

export function StatusBadge({
  status,
  labelOverride,
  className,
}: {
  status: MismatchStatus
  /** Same styling as `status`; replaces visible text (e.g. Sec 16(4) using Duplicate tones). */
  labelOverride?: string
  /** Merged into the badge; use for layout contexts (e.g. reconcile table density). */
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-medium", map[status].className, className)}>
      {labelOverride ?? status}
    </Badge>
  )
}

/** Full detail: every applicable status flag for modal / detail views. */
export function StatusBadgeStrip({ row }: { row: ReconciliationRow }) {
  const segments = buildStatusSegments(row)
  return (
    <div className="flex flex-wrap gap-1.5">
      {segments.map((seg, idx) =>
        seg.kind === "sec16" ? (
          <StatusBadge
            key={`sec16-${idx}`}
            status="Duplicate"
            labelOverride="Section 16(4) expired"
          />
        ) : (
          <StatusBadge key={`${seg.status}-${idx}`} status={seg.status} />
        ),
      )}
    </div>
  )
}
