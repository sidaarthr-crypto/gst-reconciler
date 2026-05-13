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
import type {
  ActionUrgency,
  DocumentType,
  ReconciliationFilterId,
  ReconciliationRow,
  ReconciliationSummary,
} from "@/lib/types"
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

type DocTypeTab = "all" | DocumentType

const DOC_TYPE_TABS: { id: DocTypeTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "B2B", label: "B2B" },
  { id: "B2BA", label: "B2BA" },
  { id: "CDNR", label: "Credit Notes" },
  { id: "CDNR-DN", label: "Debit Notes" },
]

function rowDocumentType(row: ReconciliationRow): DocumentType {
  return row.documentType ?? "B2B"
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
  const [activeFilters, setActiveFilters] = useState<ReconciliationFilterId[]>([])
  const [activeUrgencies, setActiveUrgencies] = useState<ActionUrgency[]>([])
  const [docTypeTab, setDocTypeTab] = useState<DocTypeTab>("all")
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

  const filtered = useMemo(() => {
    return results.filter((row) => {
      if (docTypeTab !== "all" && rowDocumentType(row) !== docTypeTab) return false
      return (
        (activeFilters.length === 0 ||
          activeFilters.some((filter) => {
            if (filter === "DeadlineWarning") return row.isDeadlineWarning && !row.isDeadlineExpired
            if (filter === "PosIssues") return row.isPOSMismatch
            if (filter === "All") return true
            return row.status === filter
          })) &&
        (activeUrgencies.length === 0 || activeUrgencies.includes(row.actionUrgency))
      )
    })
  }, [activeFilters, activeUrgencies, docTypeTab, results])

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
      <div className="mx-auto max-w-7xl space-y-6 px-4 md:px-6">
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

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
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
          <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-start md:justify-end">
            <div className="flex w-full flex-col md:w-auto md:items-end">
              <button
                type="button"
                disabled={navigating}
                onClick={() => {
                  setNavigating(true)
                  router.push("/reconcile")
                }}
                className={cn(
                  "inline-flex h-11 min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 text-sm font-medium text-white hover:bg-brand-blue/90 md:w-auto md:min-w-[200px]",
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
              className="h-11 min-h-11 w-full shrink-0 bg-brand-blue text-white hover:bg-brand-blue/90 md:h-10 md:w-auto"
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
          <div className="mb-3 flex flex-wrap gap-2 border-b border-border pb-3">
            {DOC_TYPE_TABS.map((t) => (
              <Button
                key={t.id}
                type="button"
                variant={docTypeTab === t.id ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-8 rounded-full px-3 text-xs font-medium",
                  docTypeTab === t.id
                    ? "bg-brand-blue text-white hover:bg-brand-blue/90"
                    : "border-border bg-white text-brand-navy hover:bg-slate-50",
                )}
                onClick={() => setDocTypeTab(t.id)}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <ReconciliationTable
            rows={filtered}
            loading={false}
            filterBar={{
              results,
              activeFilters,
              activeUrgencies,
              onChange: setActiveFilters,
              onUrgencyChange: setActiveUrgencies,
            }}
            vendorMessage={{
              period: `${getMonthName(session.month)} ${session.year}`,
              caName:
                isAuthenticated && displayName?.trim() ? displayName.trim() : undefined,
            }}
          />
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-border bg-slate-50 p-4 text-sm shadow-sm md:flex-row md:justify-between md:p-6">
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
          <div className="space-y-2 text-left text-muted-foreground md:text-right">
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
