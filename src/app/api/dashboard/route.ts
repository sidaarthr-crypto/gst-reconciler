import { NextRequest, NextResponse } from "next/server"

import type { Database } from "@/lib/database.types"
import type {
  DashboardKpis,
  DashboardMonthlyRow,
  DashboardPayload,
  DashboardSessionRow,
} from "@/lib/dashboard-types"
import { createServerSupabase } from "@/lib/supabase-server"
import { normaliseGSTIN } from "@/lib/utils"

type SessionRow = Database["public"]["Tables"]["reconciliation_sessions"]["Row"]

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function buildMonthlyData(
  completed: Pick<
    SessionRow,
    | "reconciliation_period_month"
    | "reconciliation_period_year"
    | "total_itc_safe"
    | "total_itc_at_risk"
    | "total_invoices"
  >[],
): DashboardMonthlyRow[] {
  const map = new Map<string, DashboardMonthlyRow>()
  for (const s of completed) {
    const key = `${s.reconciliation_period_year}-${s.reconciliation_period_month}`
    const cur = map.get(key) ?? {
      month: s.reconciliation_period_month,
      year: s.reconciliation_period_year,
      itcSafe: 0,
      itcAtRisk: 0,
      sessionCount: 0,
      totalInvoices: 0,
    }
    cur.itcSafe += num(s.total_itc_safe)
    cur.itcAtRisk += num(s.total_itc_at_risk)
    cur.sessionCount += 1
    cur.totalInvoices += num(s.total_invoices)
    map.set(key, cur)
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    return b.month - a.month
  })
}

function mapSessionRow(s: SessionRow): DashboardSessionRow {
  return {
    id: s.id,
    requestId: s.request_id,
    status: s.status,
    month: s.reconciliation_period_month,
    year: s.reconciliation_period_year,
    clientGstin: s.client_gstin ?? null,
    clientName: s.client_name ?? null,
    gstr2bFilename: s.gstr2b_filename,
    prFilename: s.pr_filename,
    totalInvoices: s.total_invoices ?? 0,
    matchedCount: s.matched_count ?? 0,
    mismatchCount: s.mismatch_count ?? 0,
    in2bOnlyCount: s.in_2b_only_count ?? 0,
    inPrOnlyCount: s.in_pr_only_count ?? 0,
    totalItcAtRisk: num(s.total_itc_at_risk),
    totalItcSafe: num(s.total_itc_safe),
    createdAt: s.created_at,
    completedAt: s.completed_at,
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const gstinRaw = req.nextUrl.searchParams.get("gstin")
    const clientGstin = gstinRaw ? normaliseGSTIN(gstinRaw) : null

    let metricsQ = supabase
      .from("reconciliation_sessions")
      .select(
        "id, client_gstin, status, total_itc_safe, total_itc_at_risk, created_at, reconciliation_period_month, reconciliation_period_year, total_invoices",
      )
      .eq("user_id", user.id)

    let listQ = supabase
      .from("reconciliation_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)

    if (clientGstin) {
      metricsQ = metricsQ.eq("client_gstin", clientGstin)
      listQ = listQ.eq("client_gstin", clientGstin)
    }

    const [metricsRes, listRes] = await Promise.all([metricsQ, listQ])

    if (metricsRes.error) {
      return NextResponse.json({ error: metricsRes.error.message }, { status: 500 })
    }
    if (listRes.error) {
      return NextResponse.json({ error: listRes.error.message }, { status: 500 })
    }

    const kpiRows = (metricsRes.data ?? []) as Pick<
      SessionRow,
      | "id"
      | "client_gstin"
      | "status"
      | "total_itc_safe"
      | "total_itc_at_risk"
      | "created_at"
      | "reconciliation_period_month"
      | "reconciliation_period_year"
      | "total_invoices"
    >[]

    const list = (listRes.data ?? []) as SessionRow[]
    const completed = kpiRows.filter((s) => s.status === "completed")

    const distinctGstin = new Set(
      completed.map((s) => s.client_gstin).filter((g): g is string => Boolean(g?.trim())),
    )
    const uniqueCustomers = distinctGstin.size

    let lastReconciledAt: string | null = null
    for (const s of completed) {
      if (!lastReconciledAt || s.created_at > lastReconciledAt) {
        lastReconciledAt = s.created_at
      }
    }

    const kpis: DashboardKpis = {
      totalSessions: kpiRows.length,
      uniqueCustomers,
      totalItcSafe: completed.reduce((a, s) => a + num(s.total_itc_safe), 0),
      totalItcAtRisk: completed.reduce((a, s) => a + num(s.total_itc_at_risk), 0),
      lastReconciledAt,
    }

    const monthlyData = buildMonthlyData(completed).slice(0, 12)

    const payload: DashboardPayload = {
      kpis,
      monthlyData,
      sessions: list.map(mapSessionRow),
    }

    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    )
  }
}
