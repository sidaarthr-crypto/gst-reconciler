"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  FileSearch,
  FileText,
  ShieldCheck,
  Users,
} from "lucide-react"

import { AllReconciliationRequestsTable } from "@/components/dashboard/AllReconciliationRequestsTable"
import { CaDashboardKpis, type CaKpiCard } from "@/components/dashboard/CaDashboardKpis"
import { buttonVariants } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import type { DashboardPayload } from "@/lib/dashboard-types"
import { cn, formatINR } from "@/lib/utils"

export default function DashboardPage() {
  const router = useRouter()
  const { loading: authLoading, displayName, isAuthenticated } = useAuth()
  const [navigating, setNavigating] = useState(false)
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [customerGstin, setCustomerGstin] = useState("")

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setFetching(true)
    setLoadError(null)
    try {
      const res = await fetch("/api/dashboard")
      const json = (await res.json()) as DashboardPayload & { error?: string }
      if (!res.ok) throw new Error(json.error ?? "Failed to load dashboard")
      setData(json)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load dashboard")
      setData(null)
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && isAuthenticated) void load()
  }, [authLoading, isAuthenticated, load])

  const customerOptions = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of data?.sessions ?? []) {
      if (r.clientGstin) {
        m.set(r.clientGstin, r.clientName?.trim() || r.clientGstin)
      }
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [data?.sessions])

  const filteredSessions = useMemo(() => {
    let rows = data?.sessions ?? []
    if (customerGstin) {
      rows = rows.filter((r) => r.clientGstin === customerGstin)
    }
    if (!debouncedSearch) return rows
    const q = debouncedSearch.toLowerCase()
    return rows.filter(
      (r) =>
        r.requestId.toLowerCase().includes(q) ||
        (r.clientName ?? "").toLowerCase().includes(q) ||
        (r.clientGstin ?? "").toLowerCase().includes(q),
    )
  }, [data?.sessions, customerGstin, debouncedSearch])

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

  const kpiItems: CaKpiCard[] = useMemo(() => {
    const k = data?.kpis
    if (!k) return []
    return [
      {
        title: "Total requests",
        value: k.totalSessions.toLocaleString("en-IN"),
        subtitle: "All statuses",
        icon: FileText,
        iconClass: "text-brand-blue",
      },
      {
        title: "Unique customers",
        value: k.uniqueCustomers.toLocaleString("en-IN"),
        subtitle: "From completed runs",
        icon: Users,
        iconClass: "text-purple-600",
      },
      {
        title: "Total ITC safe",
        value: formatINR(k.totalItcSafe),
        subtitle: "Completed reconciliations",
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
    ]
  }, [data?.kpis])

  if (authLoading || (isAuthenticated && fetching && !data)) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center bg-[#F8FAFC] px-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-brand-blue border-t-transparent"
          aria-hidden
        />
        <p className="mt-3 text-sm text-muted-foreground">Loading your dashboard…</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-[calc(100vh-120px)] bg-[#F8FAFC] pb-16 pt-8">
      <div className="mx-auto max-w-7xl space-y-6 px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">
              {greeting}, {displayName}
            </h1>
            <p className="mt-1 text-muted-foreground">
              Welcome back. Here are your recent reconciliations.
            </p>
          </div>
          <button
            type="button"
            disabled={navigating}
            onClick={() => {
              setNavigating(true)
              router.push("/reconcile")
            }}
            className={cn(
              buttonVariants({ size: "lg" }),
              "inline-flex min-w-[200px] shrink-0 cursor-pointer items-center justify-center gap-2 bg-brand-blue text-white hover:bg-brand-blue/90",
              navigating && "cursor-not-allowed opacity-70",
            )}
          >
            {navigating ? (
              <span
                className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent"
                aria-hidden
              />
            ) : null}
            {navigating ? "Opening..." : "+ New Reconciliation"}
          </button>
        </div>

        {loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {loadError}
          </div>
        ) : null}

        {data ? <CaDashboardKpis items={kpiItems} /> : null}

        {!loadError && data && data.sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-white py-20 text-center shadow-sm">
            <FileSearch className="h-14 w-14 text-muted-foreground/50" aria-hidden />
            <div>
              <p className="text-lg font-semibold text-brand-navy">No reconciliations yet</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Upload your first GSTR-2B to get started.
              </p>
            </div>
            <Link
              href="/reconcile"
              className={cn(
                buttonVariants({ size: "lg" }),
                "inline-flex items-center gap-2 bg-brand-blue text-white hover:bg-brand-blue/90",
              )}
            >
              Start reconciling →
            </Link>
          </div>
        ) : null}

        {data && data.sessions.length > 0 ? (
          <>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Request ID, customer name or GSTIN…"
                className="h-11 w-full max-w-xl rounded-lg border border-border bg-white px-3 text-sm shadow-sm outline-none ring-brand-blue/30 focus:ring-2"
              />
              <div className="flex items-center gap-2">
                <label htmlFor="customer-filter" className="text-sm text-muted-foreground whitespace-nowrap">
                  Customer
                </label>
                <select
                  id="customer-filter"
                  value={customerGstin}
                  onChange={(e) => setCustomerGstin(e.target.value)}
                  className="h-11 min-w-[200px] rounded-lg border border-border bg-white px-3 text-sm shadow-sm"
                >
                  <option value="">All customers</option>
                  {customerOptions.map(([gstin, label]) => (
                    <option key={gstin} value={gstin}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {filteredSessions.length === 0 ? (
              <div className="rounded-xl border border-border bg-white py-12 text-center shadow-sm">
                <p className="font-medium text-brand-navy">No reconciliations found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try adjusting your search or customer filter.
                </p>
                <button
                  type="button"
                  className="mt-3 text-sm font-medium text-brand-blue hover:underline"
                  onClick={() => {
                    setSearch("")
                    setCustomerGstin("")
                  }}
                >
                  Clear search →
                </button>
              </div>
            ) : (
              <AllReconciliationRequestsTable rows={filteredSessions} variant="full" />
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
