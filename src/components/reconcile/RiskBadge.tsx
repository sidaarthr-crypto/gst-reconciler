import {
  buildRiskSegmentKinds,
  highestItcRiskLevel,
  riskSegmentLabel,
} from "@/components/reconcile/badge-display"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { ITCRiskLevel, ReconciliationRow } from "@/lib/types"

/** Dot + label only (no filled pill). Medium uses darker label text for contrast on amber. */
const RISK_DOT: Record<ITCRiskLevel, { dot: string; labelClass: string }> = {
  Critical: { dot: "bg-[#C0392B]", labelClass: "text-slate-800" },
  High: { dot: "bg-[#E67E22]", labelClass: "text-slate-800" },
  Medium: { dot: "bg-[#F39C12]", labelClass: "text-[#1A1A1A]" },
  Low: { dot: "bg-[#2980B9]", labelClass: "text-slate-800" },
  Safe: { dot: "bg-[#27AE60]", labelClass: "text-slate-800" },
  None: { dot: "bg-[#95A5A6]", labelClass: "text-slate-800" },
}

function riskLevelWord(level: ITCRiskLevel): string {
  return level
}

function RiskLevelRow({ level }: { level: ITCRiskLevel }) {
  const s = RISK_DOT[level]
  return (
    <span
      className={cn(
        "inline-flex max-w-max shrink-0 items-center gap-1.5 text-xs font-medium whitespace-nowrap",
        s.labelClass,
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", s.dot)} aria-hidden />
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
        <RiskLevelRow level={level} />
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

  return <RiskLevelRow level={level} />
}
