"use client"

import { useMemo, useState } from "react"
import { Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ReconciliationFilterId, ReconciliationRow } from "@/lib/types"

type Pill = { id: ReconciliationFilterId; label: string; count: (rows: ReconciliationRow[]) => number }

const ALL_PILLS: Pill[] = [
  { id: "All", label: "All", count: (r) => r.length },
  { id: "Matched", label: "Matched", count: (r) => r.filter((x) => x.status === "Matched").length },
  { id: "Value Mismatch", label: "Value Mismatch", count: (r) => r.filter((x) => x.status === "Value Mismatch").length },
  { id: "Tax Type Mismatch", label: "Tax Type Mismatch", count: (r) => r.filter((x) => x.status === "Tax Type Mismatch").length },
  { id: "Suggested Match", label: "Suggested Match", count: (r) => r.filter((x) => x.status === "Suggested Match").length },
  { id: "In 2B Only", label: "In 2B Only", count: (r) => r.filter((x) => x.status === "In 2B Only").length },
  { id: "In PR Only", label: "In PR Only", count: (r) => r.filter((x) => x.status === "In PR Only").length },
  {
    id: "QRMP Delay",
    label: "QRMP Delay",
    count: (r) => r.filter((x) => x.status === "QRMP Delay").length,
  },
  { id: "Duplicate", label: "Duplicates", count: (r) => r.filter((x) => x.status === "Duplicate").length },
  { id: "RCM Invoice", label: "RCM Invoices", count: (r) => r.filter((x) => x.status === "RCM Invoice").length },
  {
    id: "DeadlineWarning",
    label: "Deadline Warning",
    count: (r) => r.filter((x) => x.isDeadlineWarning && !x.isDeadlineExpired).length,
  },
  { id: "PosIssues", label: "POS Issues", count: (r) => r.filter((x) => x.isPOSMismatch).length },
]

export function FilterBar({
  results,
  active,
  onChange,
}: {
  results: ReconciliationRow[]
  active: ReconciliationFilterId
  onChange: (f: ReconciliationFilterId) => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)

  const visiblePills = useMemo(() => {
    return ALL_PILLS.filter((p) => p.id === "All" || p.count(results) > 0)
  }, [results])

  return (
    <div className="flex flex-wrap gap-2">
      {visiblePills.map((f) => {
        const n = f.count(results)
        const isOn = active === f.id
        const idKey = String(f.id)
        const busy = busyId === idKey
        const isQrmp = f.id === "QRMP Delay"
        return (
          <button
            key={f.id}
            type="button"
            disabled={busyId !== null}
            onClick={() => {
              if (busyId !== null) return
              setBusyId(idKey)
              onChange(f.id)
              window.setTimeout(() => setBusyId(null), 120)
            }}
            className={cn(
              "inline-flex min-w-[5.5rem] items-center justify-center rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              "disabled:pointer-events-none disabled:opacity-70",
              isOn
                ? isQrmp
                  ? "border-slate-500 bg-slate-600 text-white"
                  : "border-brand-blue bg-brand-blue text-white"
                : isQrmp
                  ? "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  : "border-border bg-white text-brand-navy hover:bg-surface-2",
            )}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {busy ? (
                <span
                  className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />
              ) : null}
              {isQrmp ? <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
              {f.label} ({n})
            </span>
          </button>
        )
      })}
    </div>
  )
}
