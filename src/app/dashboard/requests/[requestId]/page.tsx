"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Building2, ChevronRight, Download, RefreshCw } from "lucide-react"

import { GSTR3BSummary } from "@/components/reconcile/GSTR3BSummary"
import { ReconciliationTable } from "@/components/reconcile/ReconciliationTable"
import { SummaryCards } from "@/components/reconcile/SummaryCards"
import { Button } from "@/components/ui/button"
import { exportReconciliationWorkbook } from "@/lib/export"
import type { ReconciliationFilterId, ReconciliationRow, ReconciliationSummary } from "@/lib/types"
import { useAuth } from "@/hooks/useAuth"
import { calculateGSTR3BSummary } from "@/lib/reconcile"
import { cn, getMonthName } from "@/lib/utils"

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
  clientGstin: string | null
  clientName: string | null
  summary: ReconciliationSummary
  createdAt: string
  completedAt?: string
}

export default function RequestDetailPage() {
  const { isAuthenticated, displayName } = useAuth()
  const params = useParams()
  const router = useRouter()
  const requestIdParam = decodeURIComponent(String(params.requestId ?? ""))

  const [goingBack, setGoingBack] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<SessionPayload | null>(null)
  const [results, setResults] = useState<ReconciliationRow[]>([])
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null)
  const [filter, setFilter] = useState<ReconciliationFilterId>("All")
  const [exportBusy, setExportBusy] = useState(false)
  const [navigating, setNavigating] = useState(false)

  const load = useCallback(async () => {
    if (!requestIdParam) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(requestIdParam)}`)
      const json = (await res.json()) as {
        error?: string
        session?: SessionPayload
        results?: ReconciliationRow[]
        summary?: ReconciliationSummary
      }
      if (!res.ok) throw new Error(json.error ?? "Session not found")
      setSession(json.session ?? null)
      setResults(json.results ?? [])
      setSummary(json.summary ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load reconciliation")
      setSession(null)
      setResults([])
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [requestIdParam])

  useEffect(() => {
    void load()
  }, [load])

  function onBackToDashboard() {
    setGoingBack(true)
    try {
      router.push("/dashboard")
    } catch {
      setGoingBack(false)
    }
  }

  const filtered =
    filter === "All"
      ? results
      : filter === "DeadlineWarning"
        ? results.filter((r) => r.isDeadlineWarning && !r.isDeadlineExpired)
        : filter === "PosIssues"
          ? results.filter((r) => r.isPOSMismatch)
          : results.filter((r) => r.status === filter)

  const gstr3bSummary = useMemo(() => calculateGSTR3BSummary(results), [results])

  function onExport() {
    if (!session || !summary) return
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

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center bg-[#F8FAFC] px-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-brand-blue border-t-transparent"
          aria-hidden
        />
        <p className="mt-3 text-sm text-muted-foreground">Loading reconciliation…</p>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-red-700">{error ?? "Reconciliation not found."}</p>
        <button
          type="button"
          disabled={goingBack}
          onClick={onBackToDashboard}
          className={cn(
            "mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-brand-blue",
            goingBack && "pointer-events-none opacity-60",
          )}
        >
          {goingBack ? (
            <>
              <span
                className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden
              />
              Going back...
            </>
          ) : (
            "← Back to dashboard"
          )}
        </button>
      </div>
    )
  }

  const periodLabel = `${getMonthName(session.month)} ${session.year}`
  const customerLabel = session.clientName?.trim() || "Customer"
  const reconciledAt = session.completedAt ?? session.createdAt
  const reconciledDisplay = new Date(reconciledAt).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className="min-h-[calc(100vh-120px)] bg-[#F8FAFC] pb-16 pt-8">
      <div className="mx-auto max-w-7xl space-y-6 px-6">
        <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-brand-blue">
            Dashboard
          </Link>
          {session.clientGstin ? (
            <>
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              <Link
                href={`/dashboard/customers/${encodeURIComponent(session.clientGstin)}`}
                className="hover:text-brand-blue"
              >
                {customerLabel}
              </Link>
            </>
          ) : null}
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-mono text-brand-navy">{session.requestId}</span>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <button
              type="button"
              disabled={goingBack}
              onClick={onBackToDashboard}
              className={cn(
                "inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-brand-blue",
                goingBack && "pointer-events-none opacity-60",
              )}
            >
              {goingBack ? (
                <>
                  <span
                    className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                    aria-hidden
                  />
                  Going back...
                </>
              ) : (
                "← Back to Dashboard"
              )}
            </button>
            <h1 className="font-mono text-2xl font-bold text-brand-navy">{session.requestId}</h1>
            <p className="text-muted-foreground">
              {periodLabel} — B2B reconciliation
            </p>
            {session.clientGstin ? (
              <Link
                href={`/dashboard/customers/${encodeURIComponent(session.clientGstin)}`}
                className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-border bg-white px-3 py-1.5 text-sm font-medium text-brand-navy shadow-sm hover:border-brand-blue/40"
              >
                <Building2 className="h-4 w-4 shrink-0 text-brand-blue" aria-hidden />
                {customerLabel}
              </Link>
            ) : null}
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-start sm:justify-end">
            <div className="flex w-full flex-col sm:w-auto sm:items-end">
              <button
                type="button"
                disabled={navigating}
                onClick={() => {
                  setNavigating(true)
                  router.push("/reconcile")
                }}
                className={cn(
                  "inline-flex min-w-[200px] items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90",
                  navigating && "cursor-not-allowed opacity-70",
                )}
              >
                {navigating ? (
                  <span
                    className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent"
                    aria-hidden
                  />
                ) : (
                  <RefreshCw className="shrink-0" aria-hidden size={16} />
                )}
                {navigating ? "Opening..." : "Reconcile Again"}
              </button>
              <p className="mt-1 hidden max-w-[220px] text-left text-[11px] leading-snug text-muted-foreground md:block sm:text-right">
                Start a new reconciliation for any client and period
              </p>
            </div>
            <Button
              type="button"
              className="w-full shrink-0 bg-brand-blue text-white hover:bg-brand-blue/90 sm:w-auto"
              disabled={!summary || !results.length || exportBusy}
              onClick={() => onExport()}
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              {exportBusy ? "Preparing…" : "Download Excel"}
            </Button>
          </div>
        </div>

        {summary ? (
          <div className="space-y-4">
            <SummaryCards summary={summary} results={results} />
            {results.length > 0 ? (
              <GSTR3BSummary
                summary={gstr3bSummary}
                period={`${getMonthName(session.month)} ${session.year}`}
              />
            ) : null}
          </div>
        ) : null}

        <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
          <ReconciliationTable
            rows={filtered}
            loading={false}
            filterBar={{ results, active: filter, onChange: setFilter }}
            vendorMessage={{
              period: `${getMonthName(session.month)} ${session.year}`,
              caName:
                isAuthenticated && displayName?.trim() ? displayName.trim() : undefined,
            }}
          />
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-border bg-slate-50 p-6 text-sm shadow-sm md:flex-row md:justify-between">
          <div className="space-y-2 text-muted-foreground">
            <p>
              <span className="font-medium text-brand-navy">GSTR-2B:</span> {session.gstr2bFilename} ·{" "}
              {session.gstr2bRowCount.toLocaleString("en-IN")} rows parsed
            </p>
            <p>
              <span className="font-medium text-brand-navy">Purchase register:</span> {session.prFilename} ·{" "}
              {session.prRowCount.toLocaleString("en-IN")} rows
            </p>
          </div>
          <div className="space-y-2 text-right text-muted-foreground">
            <p>
              <span className="font-medium text-brand-navy">Reconciled:</span> {reconciledDisplay}
            </p>
            <p className="font-mono text-xs text-brand-navy">Request ID: {session.requestId}</p>
            <p>
              <span className="font-medium text-brand-navy">Status:</span>{" "}
              <span className="capitalize">{session.status}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
