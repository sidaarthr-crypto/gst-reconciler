import type { SessionStatusDb } from "@/lib/database.types"

export type DashboardKpis = {
  totalSessions: number
  uniqueCustomers: number
  totalItcSafe: number
  totalItcAtRisk: number
  lastReconciledAt: string | null
}

export type DashboardMonthlyRow = {
  month: number
  year: number
  itcSafe: number
  itcAtRisk: number
  sessionCount: number
  totalInvoices: number
}

export type DashboardSessionRow = {
  id: string
  requestId: string
  status: SessionStatusDb
  month: number
  year: number
  clientGstin: string | null
  clientName: string | null
  gstr2bFilename: string | null
  prFilename: string | null
  totalInvoices: number
  matchedCount: number
  mismatchCount: number
  in2bOnlyCount: number
  inPrOnlyCount: number
  totalItcAtRisk: number
  totalItcSafe: number
  createdAt: string
  completedAt: string | null
}

export type DashboardPayload = {
  kpis: DashboardKpis
  monthlyData: DashboardMonthlyRow[]
  sessions: DashboardSessionRow[]
}
