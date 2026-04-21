"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { AlertTriangle, Clock, FileText, Plus, ShieldCheck } from "lucide-react"

import { AllReconciliationRequestsTable } from "@/components/dashboard/AllReconciliationRequestsTable"
import { CaDashboardKpis, type CaKpiCard } from "@/components/dashboard/CaDashboardKpis"
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton"
import { MonthlyChart } from "@/components/dashboard/MonthlyChart"
import { buttonVariants } from "@/components/ui/button"
import { formatPeriodQuery, parsePeriodQuery } from "@/lib/dashboard-period"
import type { DashboardPayload } from "@/lib/dashboard-types"
import { stateNameFromGstinPrefix } from "@/lib/gstin-state"
import { cn, formatINR, getMonthName } from "@/lib/utils"

const GSTIN_LEN = 15

function CustomerDashboardInner() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const gstinRaw = decodeURIComponent(String(params.gstin ?? "")).trim().toUpperCase()

  const periodQ = searchParams.get("period")
  const periodParsed = parsePeriodQuery(periodQ)

  const [data, setData] = useState<DashboardPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [goingBack, setGoingBack] = useState(false)

  const load = useCallback(async () => {
    if (!gstinRaw || gstinRaw.length !== GSTIN_LEN) {
      setLoading(false)
      setData(null)
      setError("Invalid GSTIN.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard?gstin=${encodeURIComponent(gstinRaw)}`)
      const json = (await res.json()) as DashboardPayload & { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Failed to load customer")
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load customer")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [gstinRaw])

  useEffect(() => {
    void load()
  }, [load])

  const customerName = data?.sessions[0]?.clientName?.trim() || "Customer"
  const stateBadge = stateNameFromGstinPrefix(gstinRaw)

  const periodPills = useMemo(() => {
    const map = new Map<string, { month: number; year: number }>()
    for (const r of data?.sessions ?? []) {
      map.set(`${r.month}-${r.year}`, { month: r.month, year: r.year })
    }
    return [...map.values()].sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month))
  }, [data?.sessions])

  const displayMonthly = useMemo(() => {
    if (!periodParsed) return data?.monthlyData ?? []
    return (data?.monthlyData ?? []).filter(
      (m) => m.month === periodParsed.month && m.year === periodParsed.year,
    )
  }, [data?.monthlyData, periodParsed])

  const tableRows = useMemo(() => {
    let rows = data?.sessions ?? []
    if (periodParsed) {
      rows = rows.filter((r) => r.month === periodParsed.month && r.year === periodParsed.year)
    }
    return rows
  }, [data?.sessions, periodParsed])

  const kpiItems: CaKpiCard[] = useMemo(() => {
    const k = data?.kpis
    if (!k) return []
    const last = k.lastReconciledAt
      ? formatDistanceToNow(new Date(k.lastReconciledAt), { addSuffix: true })
      : "—"
    return [
      {
        title: "Total reconciliations",
        value: k.totalSessions.toLocaleString("en-IN"),
        subtitle: "For this customer",
        icon: FileText,
        iconClass: "text-brand-blue",
      },
      {
        title: "Total ITC safe",
        value: formatINR(k.totalItcSafe),
        subtitle: "Completed runs",
        icon: ShieldCheck,
        iconClass: "text-emerald-600",
        valueClass: "text-emerald-700",
      },
      {
        title: "Total ITC at risk",
        value: formatINR(k.totalItcAtRisk),
        subtitle: "Needs attention",
        icon: AlertTriangle,
        iconClass: "text-red-600",
        valueClass: "text-risk-critical",
        pulse: k.totalItcAtRisk > 0,
      },
      {
        title: "Last reconciled",
        value: last,
        subtitle: "Most recent session",
        icon: Clock,
        iconClass: "text-slate-500",
      },
    ]
  }, [data?.kpis])

  function setPeriodFilter(p: { month: number; year: number } | null) {
    const base = `/dashboard/customers/${encodeURIComponent(gstinRaw)}`
    if (!p) {
      router.push(base)
      return
    }
    router.push(`${base}?period=${formatPeriodQuery(p.month, p.year)}`)
  }

  function onBackToDashboard() {
    setGoingBack(true)
    try {
      router.push("/dashboard")
    } catch {
      setGoingBack(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center bg-[#F8FAFC] px-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-brand-blue border-t-transparent"
          aria-hidden
        />
        <p className="mt-3 text-sm text-muted-foreground">Loading customer…</p>
      </div>
    )
  }

  if (error || gstinRaw.length !== GSTIN_LEN) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-red-700">{error ?? "Customer not found."}</p>
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

  if (!data?.sessions.length) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-brand-navy">No reconciliations found for this GSTIN.</p>
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

  const chartSubtitle = periodParsed
    ? `${getMonthName(periodParsed.month)} ${periodParsed.year}`
    : "All periods"

  const singleRunNote = data.sessions.length === 1

  return (
    <div className="min-h-[calc(100vh-120px)] bg-[#F8FAFC] pb-16 pt-8">
      <div className="mx-auto max-w-7xl space-y-6 px-4 md:px-6">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-brand-blue">
            Dashboard
          </Link>
          <span aria-hidden>/</span>
          <span className="font-medium text-brand-navy">{customerName}</span>
        </nav>

        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            {stateBadge ? (
              <span className="mb-2 inline-flex rounded-full bg-brand-blue/10 px-2.5 py-0.5 text-xs font-medium text-brand-blue">
                {stateBadge}
              </span>
            ) : null}
            <h1 className="text-[28px] font-bold text-brand-navy">{customerName}</h1>
            <p className="mt-1 font-mono text-sm text-muted-foreground">{gstinRaw}</p>
          </div>
          <Link
            href="/reconcile"
            className={cn(
              buttonVariants({ size: "lg" }),
              "inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 bg-brand-blue text-white hover:bg-brand-blue/90 md:h-12 md:w-auto",
            )}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Reconcile for this client →
          </Link>
        </div>

        <CaDashboardKpis items={kpiItems} />

        <div>
          <p className="text-sm font-medium text-brand-navy">Filter by period:</p>
          <div className="-mx-1 mt-2 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:thin] md:flex-wrap md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:h-1.5">
            <button
              type="button"
              onClick={() => setPeriodFilter(null)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-2 text-sm font-medium transition-colors md:py-1.5",
                !periodParsed
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-border bg-white text-slate-700 hover:border-brand-blue/40",
              )}
            >
              All
            </button>
            {periodPills.map((p) => {
              const active =
                periodParsed?.month === p.month && periodParsed.year === p.year
              return (
                <button
                  key={`${p.month}-${p.year}`}
                  type="button"
                  onClick={() => setPeriodFilter(p)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-2 text-sm font-medium transition-colors md:py-1.5",
                    active
                      ? "border-brand-blue bg-brand-blue text-white"
                      : "border-border bg-white text-slate-700 hover:border-brand-blue/40",
                  )}
                >
                  {getMonthName(p.month).slice(0, 3)} {p.year}
                </button>
              )
            })}
          </div>
        </div>

        <MonthlyChart
          rows={displayMonthly}
          title="Monthly ITC summary"
          subtitle={chartSubtitle}
          highlightMonthYear={periodParsed}
          showSingleRunNote={singleRunNote}
        />

        {periodParsed ? (
          <div className="flex items-center justify-between rounded-lg border border-brand-blue/30 bg-brand-blue/5 px-4 py-3 text-sm text-brand-navy">
            <span>
              Showing results for {getMonthName(periodParsed.month)} {periodParsed.year}
            </span>
            <button
              type="button"
              className="font-medium text-brand-blue hover:underline"
              onClick={() => setPeriodFilter(null)}
              aria-label="Clear period filter"
            >
              ×
            </button>
          </div>
        ) : null}

        <AllReconciliationRequestsTable rows={tableRows} variant="customer" />
      </div>
    </div>
  )
}

export default function CustomerDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-[#F8FAFC] py-8">
          <DashboardSkeleton />
        </div>
      }
    >
      <CustomerDashboardInner />
    </Suspense>
  )
}
