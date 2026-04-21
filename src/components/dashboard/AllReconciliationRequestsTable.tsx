"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { formatDashboardRequestDate } from "@/lib/dashboard-dates"
import type { DashboardSessionRow } from "@/lib/dashboard-types"
import { cn, formatINR, getMonthName } from "@/lib/utils"

const PAGE_SIZE = 10

type SortKey = "createdAt" | "requestId" | "period" | "invoices"
type SortDir = "asc" | "desc"

function periodSortValue(r: DashboardSessionRow): number {
  return r.year * 12 + r.month
}

function statusBadge(status: string) {
  if (status === "completed") {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
        Completed
      </span>
    )
  }
  if (status === "failed") {
    return (
      <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-800">
        Failed
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
      {status}
    </span>
  )
}

export function AllReconciliationRequestsTable({
  rows,
  variant = "full",
}: {
  rows: DashboardSessionRow[]
  variant?: "full" | "customer"
}) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "createdAt",
    dir: "desc",
  })

  useEffect(() => {
    setPage(0)
  }, [rows])

  const sorted = useMemo(() => {
    const copy = [...rows]
    const mul = sort.dir === "asc" ? 1 : -1
    copy.sort((a, b) => {
      switch (sort.key) {
        case "createdAt":
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * mul
        case "requestId":
          return a.requestId.localeCompare(b.requestId) * mul
        case "period":
          return (periodSortValue(a) - periodSortValue(b)) * mul
        case "invoices":
          return (a.totalInvoices - b.totalInvoices) * mul
        default:
          return 0
      }
    })
    return copy
  }, [rows, sort])

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const slice = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  function onViewClick(e: React.MouseEvent, requestId: string) {
    e.preventDefault()
    e.stopPropagation()
    setLoadingId(requestId)
    try {
      router.push(`/dashboard/requests/${encodeURIComponent(requestId)}`)
    } catch {
      setLoadingId(null)
    }
  }

  function toggleSort(key: SortKey) {
    setPage(0)
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: key === "createdAt" ? "desc" : "asc" }
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" }
    })
  }

  function sortIndicator(key: SortKey) {
    if (sort.key !== key) return null
    return sort.dir === "asc" ? " ↑" : " ↓"
  }

  if (!rows.length) {
    return null
  }

  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-brand-navy">
            {variant === "customer" ? "Reconciliation history" : "All reconciliation requests"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {variant === "customer"
              ? `${rows.length} request${rows.length === 1 ? "" : "s"}`
              : "Click a row to open the full report"}
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th className="pb-3 pr-3">
                <button
                  type="button"
                  className="hover:text-brand-blue"
                  onClick={() => toggleSort("requestId")}
                >
                  Request ID{sortIndicator("requestId")}
                </button>
              </th>
              {variant === "full" ? (
                <th className="pb-3 pr-3">Customer</th>
              ) : null}
              <th className="pb-3 pr-3">
                <button
                  type="button"
                  className="hover:text-brand-blue"
                  onClick={() => toggleSort("period")}
                >
                  Period{sortIndicator("period")}
                </button>
              </th>
              <th className="pb-3 pr-3 text-right">
                <button
                  type="button"
                  className="hover:text-brand-blue"
                  onClick={() => toggleSort("invoices")}
                >
                  {variant === "customer" ? "Invoices" : "Total invoices"}
                  {sortIndicator("invoices")}
                </button>
              </th>
              <th className="pb-3 pr-3 text-center">Matched</th>
              <th className="pb-3 pr-3 text-center">Mismatches</th>
              <th className="pb-3 pr-3 text-right">ITC at risk</th>
              <th className="pb-3 pr-3">Status</th>
              <th className="pb-3 pr-3">
                <button
                  type="button"
                  className="hover:text-brand-blue"
                  onClick={() => toggleSort("createdAt")}
                >
                  Date{sortIndicator("createdAt")}
                </button>
              </th>
              <th className="pb-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => {
              const mismatchTotal = r.mismatchCount + r.in2bOnlyCount + r.inPrOnlyCount
              const detailHref = `/dashboard/requests/${encodeURIComponent(r.requestId)}`
              return (
                <tr
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(detailHref)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      router.push(detailHref)
                    }
                  }}
                  className="cursor-pointer border-b border-border/80 transition-colors hover:bg-surface-2"
                >
                  <td className="py-3 pr-3">
                    <Link
                      href={detailHref}
                      className="font-mono text-sm font-medium text-brand-blue hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.requestId}
                    </Link>
                  </td>
                  {variant === "full" ? (
                    <td className="py-3 pr-3">
                      {r.clientGstin ? (
                        <Link
                          href={`/dashboard/customers/${encodeURIComponent(r.clientGstin)}`}
                          className="block min-w-[140px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="font-semibold text-brand-navy hover:text-brand-blue">
                            {r.clientName?.trim() || "—"}
                          </span>
                          <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                            {r.clientGstin}
                          </span>
                        </Link>
                      ) : (
                        <div>
                          <span className="font-semibold text-brand-navy">
                            {r.clientName?.trim() || "—"}
                          </span>
                          <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                            No GSTIN parsed
                          </span>
                        </div>
                      )}
                    </td>
                  ) : null}
                  <td className="py-3 pr-3 text-brand-navy">
                    {getMonthName(r.month).slice(0, 3)} {r.year}
                  </td>
                  <td className="py-3 pr-3 text-right tabular-nums">
                    {r.totalInvoices.toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 pr-3 text-center">
                    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      {r.matchedCount}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-center">
                    {mismatchTotal > 0 ? (
                      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
                        {mismatchTotal}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-right">
                    {r.totalItcAtRisk > 0 ? (
                      <span className="font-semibold text-risk-critical">{formatINR(r.totalItcAtRisk)}</span>
                    ) : (
                      <span className="font-medium text-emerald-700">₹0 — Clean</span>
                    )}
                  </td>
                  <td className="py-3 pr-3">{statusBadge(r.status)}</td>
                  <td className="py-3 pr-3 text-muted-foreground">{formatDashboardRequestDate(r.createdAt)}</td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      disabled={loadingId === r.requestId}
                      onClick={(e) => onViewClick(e, r.requestId)}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "min-w-[80px] inline-flex items-center justify-center gap-1.5",
                        loadingId === r.requestId && "pointer-events-none opacity-70",
                      )}
                    >
                      {loadingId === r.requestId ? (
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

      {pageCount > 1 ? (
        <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
          <p className="text-muted-foreground">
            Page {safePage + 1} of {pageCount}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={safePage <= 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Prev
            </button>
            <button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
