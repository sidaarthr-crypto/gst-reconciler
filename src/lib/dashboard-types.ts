import type { SessionStatusDb } from "@/lib/database.types"

export type DashboardKpis = {
  totalSessions: number
  uniqueCustomers: number
  totalItcSafe: number
  totalItcAtRisk: number
  lastReconciledAt: string | null
  /** Sum of B2BA row counts across completed sessions (from saved reconciliation). */
  totalB2baCount: number
  /** Sum of CDNR (credit note) row counts across completed sessions. */
  totalCdnrCount: number
  /** Sum of CDNR-DN (debit note) row counts across completed sessions. */
  totalCdnrDnCount: number
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
  b2baCount: number
  cdnrCount: number
  cdnrDNCount: number
}

export type DashboardPayload = {
  kpis: DashboardKpis
  monthlyData: DashboardMonthlyRow[]
  sessions: DashboardSessionRow[]
}
