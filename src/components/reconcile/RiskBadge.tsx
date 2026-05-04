import {
  buildRiskSegmentKinds,
  highestItcRiskLevel,
  riskSegmentLabel,
} from "@/components/reconcile/badge-display"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
  None: {
    dot: "bg-slate-400",
    pill: "bg-slate-100 text-slate-600",
    text: "text-slate-600",
  },
}

/** Visible risk word only (never combined with status/check names). Safe maps to “Low” per product copy. */
function riskLevelWord(level: ITCRiskLevel): string {
  if (level === "Safe") return "Low"
  return level
}

function RiskLevelPill({ level }: { level: ITCRiskLevel }) {
  const s = styles[level]
  return (
    <span
      className={cn(
        "inline-flex max-w-max shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        s.pill,
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", s.dot)} />
      {riskLevelWord(level)}
    </span>
  )
}

export function RiskBadge({
  row,
  variant = "full",
}: {
  row: ReconciliationRow
  variant?: "full" | "compact"
}) {
  const kinds = buildRiskSegmentKinds(row)
  const level = highestItcRiskLevel(row)
  const restKinds = kinds.length > 1 ? kinds.slice(1) : []
  const restLabels = restKinds.map((k) => riskSegmentLabel(k, row))

  if (variant === "compact") {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <RiskLevelPill level={level} />
        {restLabels.length > 0 ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="cursor-help text-[10px] font-medium text-slate-400">
                  +{restLabels.length} more
                </span>
              }
            />
            <TooltipContent>{restLabels.join(", ")}</TooltipContent>
          </Tooltip>
        ) : null}
      </span>
    )
  }

  return <RiskLevelPill level={level} />
}
