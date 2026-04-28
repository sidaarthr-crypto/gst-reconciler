import { Clock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { MismatchStatus } from "@/lib/types"

const map: Record<
  MismatchStatus,
  { className: string }
> = {
  Matched: {
    className:
      "border-emerald-500/60 bg-transparent text-emerald-700 hover:bg-emerald-50",
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
  "QRMP Delay": {
    className: "border-transparent bg-[#F1F5F9] text-[#475569] hover:bg-slate-200/80",
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
}

export function StatusBadge({ status }: { status: MismatchStatus }) {
  if (status === "QRMP Delay") {
    return (
      <Badge
        variant="outline"
        className={cn("whitespace-nowrap font-medium", map[status].className)}
      >
        <Clock className="mr-1 h-3 w-3 shrink-0" aria-hidden />
        QRMP — Monitor
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className={cn("whitespace-nowrap font-medium", map[status].className)}>
      {status}
    </Badge>
  )
}
