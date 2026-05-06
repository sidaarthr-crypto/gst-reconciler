"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Filter, X } from "lucide-react"

import { cn } from "@/lib/utils"
import type { ActionUrgency, ReconciliationFilterId, ReconciliationRow } from "@/lib/types"

type FilterOption = {
  status: ReconciliationFilterId
  label: string
  color: "green" | "amber" | "blue" | "orange" | "slate" | "red"
  dot: string
}

const FILTER_OPTIONS: FilterOption[] = [
  { status: "Matched", label: "Matched", color: "green", dot: "#16A34A" },
  { status: "Value Mismatch", label: "Value Mismatch", color: "amber", dot: "#D97706" },
  { status: "Tax Type Mismatch", label: "Tax Type Mismatch", color: "amber", dot: "#D97706" },
  { status: "Tax Rate Mismatch", label: "Tax Rate Mismatch", color: "amber", dot: "#D97706" },
  { status: "Suggested Match", label: "Suggested Match", color: "blue", dot: "#2563EB" },
  { status: "In 2B Only", label: "In 2B Only", color: "blue", dot: "#2563EB" },
  { status: "In PR Only", label: "In PR Only", color: "orange", dot: "#EA580C" },
  { status: "QRMP Delay", label: "QRMP Delay", color: "slate", dot: "#64748B" },
  { status: "Duplicate", label: "Duplicates", color: "red", dot: "#DC2626" },
  { status: "RCM Invoice", label: "RCM Invoices", color: "amber", dot: "#D97706" },
  { status: "POS Mismatch", label: "POS Mismatch", color: "amber", dot: "#D97706" },
  { status: "ITC Blocked", label: "ITC Blocked", color: "red", dot: "#DC2626" },
  { status: "ITC Temporary", label: "ITC Temporary", color: "amber", dot: "#D97706" },
  { status: "CESS Mismatch", label: "CESS Mismatch", color: "amber", dot: "#D97706" },
  { status: "Date Gap Match", label: "Date Gap Match", color: "green", dot: "#16A34A" },
  { status: "Group Entity Match", label: "Group Entity Match", color: "green", dot: "#16A34A" },
  { status: "GSTIN Mismatch Match", label: "GSTIN Mismatch Match", color: "amber", dot: "#D97706" },
  { status: "Amount-Led Match", label: "Amount-Led Match", color: "amber", dot: "#D97706" },
  { status: "Consolidated Invoice Match", label: "Consolidated Invoice Match", color: "green", dot: "#16A34A" },
  { status: "Probable Month Match", label: "Probable Month Match", color: "amber", dot: "#CA8A04" },
  { status: "Unclaimed ITC", label: "Unclaimed ITC", color: "orange", dot: "#EA580C" },
  { status: "ITC Eligibility Uncertain", label: "ITC Eligibility Uncertain", color: "amber", dot: "#D97706" },
  { status: "Debit Note Misclassified", label: "Debit Note Misclassified", color: "red", dot: "#DC2626" },
  { status: "Partially Booked ITC", label: "Partially Booked ITC", color: "amber", dot: "#D97706" },
  { status: "ITC Reduced by Supplier", label: "ITC Reduced by Supplier", color: "amber", dot: "#D97706" },
  { status: "Non-GST Entry", label: "Non-GST Entry", color: "slate", dot: "#64748B" },
]

const FILTER_GROUPS: { heading: string; statuses: ReconciliationFilterId[] }[] = [
  {
    heading: "Advanced match",
    statuses: [
      "Date Gap Match",
      "Group Entity Match",
      "GSTIN Mismatch Match",
      "Amount-Led Match",
      "Consolidated Invoice Match",
    ],
  },
  {
    heading: "Probable",
    statuses: ["Probable Month Match"],
  },
  {
    heading: "Query",
    statuses: [
      "Unclaimed ITC",
      "ITC Eligibility Uncertain",
      "Debit Note Misclassified",
      "Partially Booked ITC",
      "ITC Reduced by Supplier",
    ],
  },
  {
    heading: "Excluded",
    statuses: ["Non-GST Entry"],
  },
]

function matchesFilter(row: ReconciliationRow, filter: ReconciliationFilterId) {
  if (filter === "DeadlineWarning") return row.isDeadlineWarning && !row.isDeadlineExpired
  if (filter === "All") return true
  return row.status === filter
}

function colorStyles(color: FilterOption["color"]) {
  switch (color) {
    case "green":
      return {
        dot: "bg-emerald-500",
        tag: "border-emerald-200 bg-emerald-50 text-emerald-700",
      }
    case "amber":
      return {
        dot: "bg-amber-500",
        tag: "border-amber-200 bg-amber-50 text-amber-700",
      }
    case "blue":
      return {
        dot: "bg-blue-500",
        tag: "border-blue-200 bg-blue-50 text-blue-700",
      }
    case "orange":
      return {
        dot: "bg-orange-500",
        tag: "border-orange-200 bg-orange-50 text-orange-700",
      }
    case "red":
      return {
        dot: "bg-red-500",
        tag: "border-red-200 bg-red-50 text-red-700",
      }
    default:
      return {
        dot: "bg-slate-500",
        tag: "border-slate-200 bg-slate-50 text-slate-700",
      }
  }
}

export function FilterBar({
  results,
  activeFilters,
  activeUrgencies,
  onChange,
  onUrgencyChange,
}: {
  results: ReconciliationRow[]
  activeFilters: ReconciliationFilterId[]
  activeUrgencies: ActionUrgency[]
  onChange: (filters: ReconciliationFilterId[]) => void
  onUrgencyChange: (urgencies: ActionUrgency[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [urgencyOpen, setUrgencyOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const urgencyRef = useRef<HTMLDivElement | null>(null)
  const activeSet = useMemo(() => new Set(activeFilters), [activeFilters])
  const urgencySet = useMemo(() => new Set(activeUrgencies), [activeUrgencies])

  const optionCounts = useMemo(() => {
    return FILTER_OPTIONS.map((option) => ({
      ...option,
      count: results.filter((row) => row.status === option.status).length,
    }))
  }, [results])

  const groupedStatusSet = useMemo(
    () => new Set(FILTER_GROUPS.flatMap((g) => g.statuses)),
    [],
  )

  const coreOptionCounts = useMemo(
    () => optionCounts.filter((o) => !groupedStatusSet.has(o.status)),
    [groupedStatusSet, optionCounts],
  )

  const shownCount = useMemo(() => {
    return results.filter((row) => {
      const statusMatch =
        activeSet.size === 0 || activeFilters.some((filter) => matchesFilter(row, filter))
      const urgencyMatch =
        urgencySet.size === 0 || activeUrgencies.includes(row.actionUrgency)
      return statusMatch && urgencyMatch
    }).length
  }, [activeFilters, activeSet, activeUrgencies, urgencySet, results])

  const urgencyOptions = useMemo(
    () =>
      [
        { value: "Immediate" as ActionUrgency, label: "Immediate", dot: "bg-red-500" },
        { value: "Before Filing" as ActionUrgency, label: "Before Filing", dot: "bg-amber-500" },
        { value: "Monitor" as ActionUrgency, label: "Monitor", dot: "bg-slate-500" },
        { value: "None" as ActionUrgency, label: "No Action", dot: "bg-slate-300" },
      ].map((item) => ({
        ...item,
        count: results.filter((row) => row.actionUrgency === item.value).length,
      })),
    [results],
  )

  useEffect(() => {
    if (!open) return
    const handleMouseDown = (event: MouseEvent) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(event.target as Node)) setOpen(false)
      if (urgencyRef.current && !urgencyRef.current.contains(event.target as Node)) {
        setUrgencyOpen(false)
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleMouseDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleMouseDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  const toggleFilter = (status: ReconciliationFilterId) => {
    const next = new Set(activeSet)
    if (next.has(status)) next.delete(status)
    else next.add(status)
    onChange(Array.from(next))
  }

  const clearAll = () => onChange([])
  const clearUrgencies = () => onUrgencyChange([])
  const toggleUrgency = (urgency: ActionUrgency) => {
    const next = new Set(urgencySet)
    if (next.has(urgency)) next.delete(urgency)
    else next.add(urgency)
    onUrgencyChange(Array.from(next))
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col flex-wrap gap-2 sm:flex-row sm:items-center sm:gap-x-3">
        <div ref={rootRef} className="relative w-full min-w-0 sm:w-auto sm:min-w-fit">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className={cn(
              "inline-flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors sm:w-auto sm:min-w-fit md:min-h-0",
              activeFilters.length > 0
                ? "border-brand-blue bg-brand-blue text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            <Filter size={14} className="shrink-0" aria-hidden />
            <span>{activeFilters.length > 0 ? `${activeFilters.length} Filters Active` : "Filter by Status"}</span>
            {activeFilters.length > 0 ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear filters"
                className="rounded p-0.5 hover:bg-white/20"
                onClick={(event) => {
                  event.stopPropagation()
                  clearAll()
                }}
              >
                <X size={12} />
              </span>
            ) : null}
            <ChevronDown size={14} className={cn("shrink-0 transition-transform", open && "rotate-180")} />
          </button>

          {open ? (
            <div className="absolute top-[calc(100%+8px)] left-0 z-50 min-w-[280px] rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <p className="text-sm font-semibold text-brand-navy">Filter by Status</p>
            {activeFilters.length > 0 ? (
              <button type="button" onClick={clearAll} className="text-xs font-medium text-blue-600">
                Clear all
              </button>
            ) : null}
          </div>
          <div className="max-h-[340px] overflow-y-auto py-1">
            {coreOptionCounts.map((option) => {
              const selected = activeSet.has(option.status)
              const styles = colorStyles(option.color)
              return (
                <button
                  key={option.status}
                  type="button"
                  onClick={() => toggleFilter(option.status)}
                  className={cn(
                    "flex h-9 w-full items-center gap-3 px-3 text-left hover:bg-slate-50",
                    option.count === 0 && "opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border",
                      selected
                        ? "border-brand-blue bg-brand-blue text-white"
                        : "border-slate-300 bg-white text-transparent",
                    )}
                  >
                    <Check size={10} />
                  </span>
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", styles.dot)} style={{ backgroundColor: option.dot }} />
                  <span
                    className={cn(
                      "flex-1 text-sm font-medium text-slate-700",
                      option.count === 0 && "italic text-slate-400",
                    )}
                  >
                    {option.label}
                  </span>
                  {option.count > 0 ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                      {option.count}
                    </span>
                  ) : null}
                </button>
              )
            })}
            {FILTER_GROUPS.map((group) => (
              <div key={group.heading}>
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {group.heading}
                </div>
                {group.statuses.map((status) => {
                  const option = optionCounts.find((o) => o.status === status)
                  if (!option) return null
                  const selected = activeSet.has(option.status)
                  const styles = colorStyles(option.color)
                  return (
                    <button
                      key={option.status}
                      type="button"
                      onClick={() => toggleFilter(option.status)}
                      className={cn(
                        "flex h-9 w-full items-center gap-3 px-3 text-left hover:bg-slate-50",
                        option.count === 0 && "opacity-60",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border",
                          selected
                            ? "border-brand-blue bg-brand-blue text-white"
                            : "border-slate-300 bg-white text-transparent",
                        )}
                      >
                        <Check size={10} />
                      </span>
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", styles.dot)} style={{ backgroundColor: option.dot }} />
                      <span
                        className={cn(
                          "flex-1 text-sm font-medium text-slate-700",
                          option.count === 0 && "italic text-slate-400",
                        )}
                      >
                        {option.label}
                      </span>
                      {option.count > 0 ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                          {option.count}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2.5">
            <p className="text-xs text-slate-500">
              {shownCount} of {results.length} invoices shown
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
            </div>
          ) : null}
        </div>

        <div ref={urgencyRef} className="relative w-full min-w-0 sm:w-auto sm:min-w-fit">
          <button
            type="button"
            onClick={() => setUrgencyOpen((prev) => !prev)}
            className={cn(
              "inline-flex min-h-11 w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors sm:w-auto sm:min-w-fit md:min-h-0",
              activeUrgencies.length > 0
                ? "border-brand-blue bg-brand-blue text-white"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
            )}
          >
            <span>Urgency{activeUrgencies.length > 0 ? `: ${activeUrgencies.length}` : ""}</span>
            {activeUrgencies.length > 0 ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear urgency filters"
                className="rounded p-0.5 hover:bg-white/20"
                onClick={(event) => {
                  event.stopPropagation()
                  clearUrgencies()
                }}
              >
                <X size={12} />
              </span>
            ) : null}
            <ChevronDown
              size={14}
              className={cn("shrink-0 transition-transform", urgencyOpen && "rotate-180")}
            />
          </button>
          {urgencyOpen ? (
            <div className="absolute top-[calc(100%+8px)] left-0 z-50 min-w-[240px] rounded-xl border border-slate-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
                <p className="text-sm font-semibold text-brand-navy">Urgency</p>
                {activeUrgencies.length > 0 ? (
                  <button type="button" onClick={clearUrgencies} className="text-xs font-medium text-blue-600">
                    Clear all
                  </button>
                ) : null}
              </div>
              <div className="max-h-[260px] overflow-y-auto py-1">
                {urgencyOptions.map((option) => {
                  const selected = urgencySet.has(option.value)
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleUrgency(option.value)}
                      className={cn(
                        "flex h-9 w-full items-center gap-3 px-3 text-left hover:bg-slate-50",
                        option.count === 0 && "opacity-60",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border",
                          selected
                            ? "border-brand-blue bg-brand-blue text-white"
                            : "border-slate-300 bg-white text-transparent",
                        )}
                      >
                        <Check size={10} />
                      </span>
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", option.dot)} />
                      <span className="flex-1 text-sm font-medium text-slate-700">{option.label}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-400">
                        {option.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {activeFilters.length > 0 || activeUrgencies.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {activeFilters.map((filter) => {
            const option = FILTER_OPTIONS.find((item) => item.status === filter)
            if (!option) return null
            const styles = colorStyles(option.color)
            return (
              <span
                key={filter}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                  styles.tag,
                )}
              >
                {option.label}
                <button
                  type="button"
                  aria-label={`Remove ${option.label} filter`}
                  onClick={() => toggleFilter(filter)}
                  className="rounded p-0.5 hover:bg-black/5"
                >
                  <X size={10} />
                </button>
              </span>
            )
          })}
          {activeUrgencies.map((urgency) => (
            <span
              key={urgency}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700"
            >
              {urgency === "None" ? "No Action" : urgency}
              <button
                type="button"
                aria-label={`Remove ${urgency} urgency filter`}
                onClick={() => toggleUrgency(urgency)}
                className="rounded p-0.5 hover:bg-black/5"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
