"use client"

import { useState } from "react"
import { SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn, getMonthName } from "@/lib/utils"

export type DashboardFilters = {
  month: number | ""
  year: number | ""
  status: "all" | "completed" | "failed"
  itcRisk: "any" | "has" | "none"
  dateFrom: string
  dateTo: string
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const YEARS = Array.from({ length: 14 }, (_, i) => 2017 + i)

export function FilterPanel({
  filters,
  onChange,
  onApply,
  onClear,
  activeCount,
}: {
  filters: DashboardFilters
  onChange: (f: DashboardFilters) => void
  onApply: () => void
  onClear: () => void
  activeCount: number
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-brand-navy shadow-sm transition hover:bg-surface-2",
          open && "border-brand-blue ring-1 ring-brand-blue/20",
        )}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden />
        Filters{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>
      {open ? (
        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-brand-navy">
              Period — month
              <select
                className="rounded-md border border-border bg-white px-2 py-1.5 text-sm"
                value={filters.month === "" ? "" : String(filters.month)}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    month: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              >
                <option value="">Any</option>
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {getMonthName(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-brand-navy">
              Period — year
              <select
                className="rounded-md border border-border bg-white px-2 py-1.5 text-sm"
                value={filters.year === "" ? "" : String(filters.year)}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    year: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              >
                <option value="">Any</option>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-brand-navy">
              Status
              <select
                className="rounded-md border border-border bg-white px-2 py-1.5 text-sm"
                value={filters.status}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    status: e.target.value as DashboardFilters["status"],
                  })
                }
              >
                <option value="all">All</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-brand-navy">
              ITC at risk
              <select
                className="rounded-md border border-border bg-white px-2 py-1.5 text-sm"
                value={filters.itcRisk}
                onChange={(e) =>
                  onChange({
                    ...filters,
                    itcRisk: e.target.value as DashboardFilters["itcRisk"],
                  })
                }
              >
                <option value="any">Any</option>
                <option value="has">Has risk</option>
                <option value="none">No risk</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-brand-navy">
              From date
              <input
                type="date"
                className="rounded-md border border-border bg-white px-2 py-1.5 text-sm"
                value={filters.dateFrom}
                onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-brand-navy">
              To date
              <input
                type="date"
                className="rounded-md border border-border bg-white px-2 py-1.5 text-sm"
                value={filters.dateTo}
                onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button type="button" size="sm" className="bg-brand-blue text-white" onClick={onApply}>
              Apply filters
            </Button>
            <button
              type="button"
              className="text-sm font-medium text-muted-foreground underline-offset-2 hover:text-brand-navy hover:underline"
              onClick={onClear}
            >
              Clear all
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
