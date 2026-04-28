import { ArrowLeftRight, Clock, Copy, MapPin } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ITCRiskLevel, ReconciliationRow } from "@/lib/types"

const styles: Record<
  ITCRiskLevel,
  { dot: string; pill: string; text: string }
> = {
  Critical: {
    dot: "bg-risk-critical",
    pill: "bg-risk-critical-bg text-risk-critical",
    text: "text-risk-critical",
  },
  High: {
    dot: "bg-risk-high",
    pill: "bg-risk-high-bg text-risk-high",
    text: "text-risk-high",
  },
  Medium: {
    dot: "bg-risk-medium",
    pill: "bg-risk-medium-bg text-risk-medium",
    text: "text-risk-medium",
  },
  Low: {
    dot: "bg-sky-500",
    pill: "bg-sky-50 text-sky-900",
    text: "text-sky-900",
  },
  Safe: {
    dot: "bg-risk-safe",
    pill: "bg-risk-safe-bg text-risk-safe",
    text: "text-risk-safe",
  },
}

function PosAddon() {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        "bg-amber-100 text-amber-900",
      )}
    >
      <MapPin className="h-3 w-3 shrink-0" aria-hidden />
      POS
    </span>
  )
}

export function RiskBadge({ row }: { row: ReconciliationRow }) {
  const posAddon = row.isPOSMismatch ? <PosAddon /> : null

  if (row.isDuplicate || row.status === "Duplicate") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
            "bg-risk-critical-bg text-risk-critical",
          )}
        >
          <Copy className="h-3 w-3 shrink-0" aria-hidden />
          Critical — Duplicate
        </span>
        {posAddon}
      </span>
    )
  }

  if (row.isDeadlineExpired) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
            "bg-risk-critical-bg text-risk-critical",
          )}
        >
          <Clock className="h-3 w-3 shrink-0" aria-hidden />
          Critical — Expired
        </span>
        {posAddon}
      </span>
    )
  }

  if (row.isDeadlineWarning && !row.isDeadlineExpired && row.daysToDeadline != null) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
            "bg-risk-high-bg text-risk-high",
          )}
        >
          <Clock className="h-3 w-3 shrink-0" aria-hidden />
          High — {row.daysToDeadline} days left
        </span>
        {posAddon}
      </span>
    )
  }

  if (row.isTaxTypeMismatch || row.status === "Tax Type Mismatch") {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
            "bg-amber-100 text-amber-900",
          )}
        >
          <ArrowLeftRight className="h-3 w-3 shrink-0" aria-hidden />
          Tax Type
        </span>
        {posAddon}
      </span>
    )
  }

  const risk = row.itcRisk
  const s = styles[risk]
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
          s.pill,
        )}
      >
        <span className={cn("h-2 w-2 shrink-0 rounded-full", s.dot)} />
        {risk}
      </span>
      {posAddon}
    </span>
  )
}
