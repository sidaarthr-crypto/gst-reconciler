"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, X } from "lucide-react"

import { ReconciliationTable } from "@/components/reconcile/ReconciliationTable"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { exportReconciliationWorkbook } from "@/lib/export"
import { getMonthName } from "@/lib/utils"
import { isReconciliationIssueRow } from "@/lib/reconcile"
import type { ActionUrgency, ReconciliationFilterId, ReconciliationRow, ReconciliationSummary } from "@/lib/types"

type SessionPayload = {
  id: string
  requestId: string
  status: string
  month: number
  year: number
  gstr2bFilename: string
  gstr2bRowCount: number
  prFilename: string
  prRowCount: number
  summary: ReconciliationSummary
  createdAt: string
  completedAt?: string
}

export function ReportModal({
  sessionId,
  onClose,
}: {
  sessionId: string | null
  onClose: () => void
}) {
  const { isAuthenticated, displayName } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<SessionPayload | null>(null)
  const [results, setResults] = useState<ReconciliationRow[]>([])
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null)
  const [activeFilters, setActiveFilters] = useState<ReconciliationFilterId[]>([])
  const [activeUrgencies, setActiveUrgencies] = useState<ActionUrgency[]>([])
  const [exportBusy, setExportBusy] = useState(false)

  useEffect(() => {
    if (!sessionId) {
      setSession(null)
      setResults([])
      setSummary(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}`)
        const json = (await res.json()) as {
          error?: string
          session?: SessionPayload
          results?: ReconciliationRow[]
          summary?: ReconciliationSummary
        }
        if (!res.ok) throw new Error(json.error ?? "Could not load report")
        if (cancelled) return
        setSession(json.session ?? null)
        setResults(json.results ?? [])
        setSummary(json.summary ?? null)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error")
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const filtered = useMemo(() => {
    return results.filter((row) =>
      (activeFilters.length === 0 ||
        activeFilters.some((filter) => {
          if (filter === "DeadlineWarning") return row.isDeadlineWarning && !row.isDeadlineExpired
          if (filter === "PosIssues") return row.isPOSMismatch
          if (filter === "All") return true
          return row.status === filter
        })) &&
      (activeUrgencies.length === 0 || activeUrgencies.includes(row.actionUrgency)),
    )
  }, [activeFilters, activeUrgencies, results])

  function onDownload() {
    if (!session || !summary || !results.length) return
    setExportBusy(true)
    window.setTimeout(() => {
      try {
        exportReconciliationWorkbook({
          month: session.month,
          year: session.year,
          requestId: session.requestId,
          gstr2bFilename: session.gstr2bFilename,
          prFilename: session.prFilename,
          summary,
          rows: results,
        })
      } finally {
        setExportBusy(false)
      }
    }, 0)
  }

  if (!sessionId) return null

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close overlay"
        onClick={onClose}
      />
      <div
        className="relative flex h-full w-full max-w-5xl flex-col border-l border-border bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <p className="font-mono text-lg font-bold text-brand-navy md:text-xl">{session?.requestId ?? "…"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {session
                ? `${getMonthName(session.month)} ${session.year} — B2B reconciliation`
                : "Loading…"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-brand-blue text-white hover:bg-brand-blue/90"
              disabled={!session || !summary || !results.length || exportBusy}
              onClick={onDownload}
            >
              {exportBusy ? "Preparing…" : (
                <>
                  <Download className="mr-2 h-4 w-4" aria-hidden />
                  Download Excel
                </>
              )}
            </Button>
            <button
              type="button"
              className="rounded-lg p-2 text-muted-foreground hover:bg-surface-2 hover:text-brand-navy"
              aria-label="Close"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : (
            <>
              {summary && session ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Total", value: summary.totalInvoices },
                    { label: "Matched", value: summary.matchedCount },
                    {
                      label: "Issues Found",
                      value:
                        summary.issuesFoundCount ??
                        results.filter(isReconciliationIssueRow).length,
                    },
                    { label: "ITC at risk", value: summary.totalITCAtRisk, money: true },
                  ].map((c) => (
                    <div
                      key={c.label}
                      className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-center"
                    >
                      <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                      <p className="mt-1 text-xl font-bold text-brand-navy">
                        {"money" in c && c.money
                          ? new Intl.NumberFormat("en-IN", {
                              style: "currency",
                              currency: "INR",
                              maximumFractionDigits: 0,
                            }).format(Number(c.value))
                          : c.value}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-6">
                <ReconciliationTable
                  rows={filtered}
                  loading={loading}
                  filterBar={{
                    results,
                    activeFilters,
                    activeUrgencies,
                    onChange: setActiveFilters,
                    onUrgencyChange: setActiveUrgencies,
                  }}
                  vendorMessage={
                    session
                      ? {
                          period: `${getMonthName(session.month)} ${session.year}`,
                          caName:
                            isAuthenticated && displayName?.trim()
                              ? displayName.trim()
                              : undefined,
                        }
                      : undefined
                  }
                />
              </div>

              {session ? (
                <footer className="mt-8 space-y-1 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted-foreground">
                  <p>
                    <span className="font-medium text-brand-navy">GSTR-2B:</span>{" "}
                    {session.gstr2bFilename || "—"} — {session.gstr2bRowCount} rows
                  </p>
                  <p>
                    <span className="font-medium text-brand-navy">Purchase register:</span>{" "}
                    {session.prFilename || "—"} — {session.prRowCount} rows
                  </p>
                  <p>
                    <span className="font-medium text-brand-navy">Reconciled on:</span>{" "}
                    {new Date(session.completedAt ?? session.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </footer>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
