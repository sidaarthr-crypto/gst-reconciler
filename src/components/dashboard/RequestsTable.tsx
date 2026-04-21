"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn, formatINR, getMonthName } from "@/lib/utils"
import type { DashboardSessionRow } from "@/lib/dashboard-types"

type SortKey = "createdAt" | "requestId" | "period" | "totalInvoices" | "itcAtRisk"

function statusBadge(status: DashboardSessionRow["status"]) {
  if (status === "completed") {
    return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Completed</Badge>
  }
  if (status === "failed") {
    return <Badge variant="destructive">Failed</Badge>
  }
  if (status === "processing" || status === "pending") {
    return (
      <Badge className="border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-50">
        {status === "processing" ? "Processing" : "Pending"}
      </Badge>
    )
  }
  return <Badge variant="secondary">{status}</Badge>
}

function truncate(s: string | null, n: number) {
  if (!s) return "—"
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

export function RequestsTable({
  rows,
  page,
  pageSize,
  totalFiltered,
  sortKey,
  sortDir,
  onSort,
  onPageChange,
  onOpenReport,
}: {
  rows: DashboardSessionRow[]
  page: number
  pageSize: number
  totalFiltered: number
  sortKey: SortKey
  sortDir: "asc" | "desc"
  onSort: (k: SortKey) => void
  onPageChange: (p: number) => void
  /** Optional; row click still invokes this when provided. View → always navigates to the request detail page. */
  onOpenReport?: (session: DashboardSessionRow) => void
}) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize))
  const pageSafe = Math.min(page, totalPages - 1)
  const start = pageSafe * pageSize

  const th = (k: SortKey, label: string, className?: string) => (
    <th className={cn("px-3 py-2", className)}>
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 font-medium hover:text-brand-blue",
          sortKey === k && "text-brand-blue",
        )}
        onClick={() => onSort(k)}
      >
        {label}
        {sortKey === k ? <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span> : null}
      </button>
    </th>
  )

  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm" id="recent-reconciliations">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">Recent reconciliations</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalFiltered} session{totalFiltered === 1 ? "" : "s"}
          </p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead className="border-b border-border bg-surface-2 text-left text-xs font-medium text-brand-navy">
            <tr>
              {th("requestId", "Request ID")}
              {th("period", "Period")}
              <th className="px-3 py-2">GSTR-2B file</th>
              <th className="px-3 py-2">Purchase register</th>
              {th("totalInvoices", "Total invoices", "text-right")}
              <th className="px-3 py-2 text-right">Matched</th>
              <th className="px-3 py-2 text-right">Mismatches</th>
              {th("itcAtRisk", "ITC at risk", "text-right")}
              <th className="px-3 py-2">Status</th>
              {th("createdAt", "Date")}
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const mismatchTotal =
                (s.mismatchCount ?? 0) + (s.in2bOnlyCount ?? 0) + (s.inPrOnlyCount ?? 0)
              const rel = formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })
              return (
                <tr
                  key={s.id}
                  className="cursor-pointer border-t border-border transition-colors hover:bg-surface-2"
                  onClick={() => onOpenReport?.(s)}
                >
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="font-mono text-sm font-semibold text-brand-blue underline-offset-2 hover:underline"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenReport?.(s)
                      }}
                    >
                      {s.requestId}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-brand-navy">
                    {getMonthName(s.month)} {s.year}
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2 text-muted-foreground" title={s.gstr2bFilename ?? ""}>
                    {truncate(s.gstr2bFilename, 28)}
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2 text-muted-foreground" title={s.prFilename ?? ""}>
                    {truncate(s.prFilename, 28)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.totalInvoices}</td>
                  <td className="px-3 py-2 text-right">
                    <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">
                      {s.matchedCount}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Badge className="border border-amber-200 bg-amber-50 text-amber-950 hover:bg-amber-50">
                      {mismatchTotal}
                    </Badge>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-medium tabular-nums",
                      s.totalItcAtRisk > 0 ? "text-red-700" : "text-muted-foreground",
                    )}
                  >
                    {formatINR(s.totalItcAtRisk)}
                  </td>
                  <td className="px-3 py-2">{statusBadge(s.status)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{rel}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={loadingId === s.requestId}
                      onClick={(e) => {
                        e.stopPropagation()
                        setLoadingId(s.requestId)
                        try {
                          router.push(`/dashboard/requests/${encodeURIComponent(s.requestId)}`)
                        } catch {
                          setLoadingId(null)
                        }
                      }}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "min-w-[80px] inline-flex items-center justify-center gap-1.5 border-brand-navy text-brand-navy",
                        loadingId === s.requestId && "pointer-events-none opacity-70",
                      )}
                    >
                      {loadingId === s.requestId ? (
                        <>
                          <span
                            className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                            aria-hidden
                          />
                          Loading...
                        </>
                      ) : (
                        "View →"
                      )}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">
            Showing {start + 1}–{Math.min(start + pageSize, totalFiltered)} of {totalFiltered}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pageSafe <= 0}
              onClick={() => onPageChange(pageSafe - 1)}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Prev
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pageSafe >= totalPages - 1}
              onClick={() => onPageChange(pageSafe + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
