import type { ITCRiskLevel, MismatchStatus, ReconciliationRow } from "@/lib/types"

/** ITC risk tiers for picking the single worst level across overlays. */
const ITC_RISK_ORDER: ITCRiskLevel[] = [
  "Critical",
  "High",
  "Medium",
  "Low",
  "Safe",
  "None",
]

export type RiskSegmentKind =
  | "duplicate"
  | "expired"
  | "deadline_warn"
  | "tax_type"
  | "none_pill"
  | "itc"
  | "pos"

export function buildRiskSegmentKinds(row: ReconciliationRow): RiskSegmentKind[] {
  const kinds: RiskSegmentKind[] = []
  if (row.isDuplicate || row.status === "Duplicate") kinds.push("duplicate")
  else if (row.isDeadlineExpired) kinds.push("expired")
  else if (row.isDeadlineWarning && !row.isDeadlineExpired && row.daysToDeadline != null) {
    kinds.push("deadline_warn")
  } else if (row.isTaxTypeMismatch || row.status === "Tax Type Mismatch") kinds.push("tax_type")
  else if (row.status === "Non-GST Entry" || row.itcRisk === "None") kinds.push("none_pill")
  else kinds.push("itc")
  if (row.isPOSMismatch) kinds.push("pos")
  return kinds
}

/** Labels for tooltips / “+N more” — never concatenate risk tier + check name. */
export function riskSegmentLabel(kind: RiskSegmentKind, row: ReconciliationRow): string {
  switch (kind) {
    case "duplicate":
      return "Duplicate"
    case "expired":
      return "Sec 16(4) Expired"
    case "deadline_warn":
      return `${row.daysToDeadline ?? "?"} days left`
    case "tax_type":
      return "Tax Type Mismatch"
    case "none_pill":
      return "None"
    case "itc":
      return row.itcRisk === "Safe" ? "Low" : row.itcRisk
    case "pos":
      return "POS Mismatch"
    default:
      return ""
  }
}

/** Highest ITC risk level implied by row state (for ordering duplicate/expired vs base itcRisk). */
export function highestItcRiskLevel(row: ReconciliationRow): ITCRiskLevel {
  const rank = (x: ITCRiskLevel) =>
    ITC_RISK_ORDER.indexOf(x) === -1 ? 99 : ITC_RISK_ORDER.indexOf(x)

  let best: ITCRiskLevel = row.itcRisk
  if (row.isDuplicate || row.status === "Duplicate") best = "Critical"
  if (row.isDeadlineExpired) best = "Critical"
  if (row.isDeadlineWarning && !row.isDeadlineExpired && row.daysToDeadline != null) {
    if (rank("High") < rank(best)) best = "High"
  }
  if (row.isTaxTypeMismatch || row.status === "Tax Type Mismatch") {
    if (rank("Medium") < rank(best)) best = "Medium"
  }
  return best
}

/**
 * Status priority for the table (lower index = more critical).
 * Synthetic deadline rows use `__SEC16__` when `isDeadlineExpired` outranks canonical status.
 */
export const STATUS_DISPLAY_PRIORITY: (MismatchStatus | "__SEC16__")[] = [
  "Sec 16(4) Expired",
  "Debit Note Misclassified",
  "ITC Blocked",
  "ITC Temporary",
  "Duplicate",
  "__SEC16__",
  "Value Mismatch",
  "Tax Type Mismatch",
  "Tax Rate Mismatch",
  "POS Mismatch",
  "CESS Mismatch",
  "Period Timing Mismatch",
  "In PR Only",
  "In 2B Only",
  "Suggested Match",
  "QRMP Delay",
  "RCM Invoice",
  "Date Gap Match",
  "Group Entity Match",
  "GSTIN Mismatch Match",
  "Amount-Led Match",
  "Consolidated Invoice Match",
  "Probable Month Match",
  "Unclaimed ITC",
  "ITC Eligibility Uncertain",
  "Partially Booked ITC",
  "ITC Reduced by Supplier",
  "Matched",
  "Non-GST Entry",
]

export function statusPriorityIndex(s: MismatchStatus | "__SEC16__"): number {
  const i = STATUS_DISPLAY_PRIORITY.indexOf(s)
  return i === -1 ? 999 : i
}

export type StatusSegment =
  | { kind: "status"; status: MismatchStatus }
  | { kind: "sec16" }

export function buildStatusSegments(row: ReconciliationRow): StatusSegment[] {
  const out: StatusSegment[] = [{ kind: "status", status: row.status }]
  if (row.isDeadlineExpired && row.status !== "Sec 16(4) Expired") out.push({ kind: "sec16" })
  if (row.isPOSMismatch && row.status !== "POS Mismatch") {
    out.push({ kind: "status", status: "POS Mismatch" })
  }
  return out
}

export function statusSegmentLabel(seg: StatusSegment): string {
  if (seg.kind === "sec16") return "Section 16(4) expired"
  return seg.status
}

/** Pick the single most critical status segment for compact table display. */
export function primaryStatusSegment(row: ReconciliationRow): StatusSegment {
  const segments = buildStatusSegments(row)
  let best = segments[0]!
  let bestRank = statusPriorityIndex(best.kind === "sec16" ? "__SEC16__" : best.status)
  for (let i = 1; i < segments.length; i++) {
    const s = segments[i]!
    const r = statusPriorityIndex(s.kind === "sec16" ? "__SEC16__" : s.status)
    if (r < bestRank) {
      best = s
      bestRank = r
    }
  }
  return best
}

export function statusSegmentsEqual(a: StatusSegment, b: StatusSegment): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === "sec16" && b.kind === "sec16") return true
  return a.kind === "status" && b.kind === "status" && a.status === b.status
}

/** Segments other than the primary (most critical) — for “+N more” tooltips. */
export function statusSegmentsExceptPrimary(row: ReconciliationRow): StatusSegment[] {
  const primary = primaryStatusSegment(row)
  return buildStatusSegments(row).filter((s) => !statusSegmentsEqual(s, primary))
}
