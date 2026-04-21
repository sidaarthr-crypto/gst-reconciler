import { cn } from "@/lib/utils"
import type { ActionUrgency } from "@/lib/types"

const map: Record<
  ActionUrgency,
  { label: string; className: string }
> = {
  Immediate: {
    label: "Act Now",
    className: "bg-red-600 text-white",
  },
  "Before Filing": {
    label: "Before Filing",
    className: "bg-amber-500 text-white",
  },
  Monitor: {
    label: "Monitor",
    className: "bg-brand-blue text-white",
  },
  None: {
    label: "Clear",
    className: "bg-emerald-600 text-white",
  },
}

export function ActionBadge({ urgency }: { urgency: ActionUrgency }) {
  const m = map[urgency]
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        m.className,
      )}
    >
      {m.label}
    </span>
  )
}
