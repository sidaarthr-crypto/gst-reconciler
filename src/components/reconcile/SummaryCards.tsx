"use client"

import { useCallback, useMemo, useState } from "react"
import {
  AlertOctagon,
  AlertTriangle,
  Clock,
  Copy,
  FileText,
  FileX,
  ShieldCheck,
  X,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { isReconciliationIssueRow } from "@/lib/reconcile"
import { formatINR } from "@/lib/utils"
import type { ReconciliationRow, ReconciliationSummary } from "@/lib/types"

const ALERT_KEYS = ["dup", "taxType"] as const

type AlertKey = (typeof ALERT_KEYS)[number]

export function SummaryCards({
  summary,
  results,
}: {
  summary: ReconciliationSummary
  results: ReconciliationRow[]
}) {
  const [dismissed, setDismissed] = useState<Set<AlertKey>>(() => new Set())

  const dismiss = useCallback((k: AlertKey) => {
    setDismissed((prev) => new Set(prev).add(k))
  }, [])

  const issuesCount =
    summary.issuesFoundCount ?? results.filter(isReconciliationIssueRow).length

  const expiredCount = useMemo(
    () => results.filter((r) => r.isDeadlineExpired).length,
    [results],
  )

  const warningCount = useMemo(
    () => results.filter((r) => r.isDeadlineWarning && !r.isDeadlineExpired).length,
    [results],
  )

  const nearestDeadlineLabel = useMemo(() => {
    const rows = results.filter(
      (r) => r.isDeadlineWarning && !r.isDeadlineExpired && r.itcClaimDeadline != null,
    )
    if (!rows.length) return null
    const nearest = rows.reduce((a, b) =>
      (a.daysToDeadline ?? 9999) <= (b.daysToDeadline ?? 9999) ? a : b,
    )
    return nearest.itcClaimDeadline
  }, [results])

  const in2BOnlyDisplay = results.filter((r) => r.status === "In 2B Only").length
  const inPROnlyDisplay = results.filter((r) => r.status === "In PR Only").length
  const missingOnly = in2BOnlyDisplay + inPROnlyDisplay

  const showDup = summary.duplicateCount > 0 && !dismissed.has("dup")
  const showTaxType = summary.taxTypeMismatchCount > 0 && !dismissed.has("taxType")

  const attention = showDup || showTaxType

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Card className="border-border shadow-sm">
          <CardContent className="flex gap-4 p-5">
            <FileText className="h-8 w-8 shrink-0 text-brand-blue" aria-hidden />
            <div>
              <p className="text-4xl font-semibold text-brand-navy">
                {summary.totalInvoices}
              </p>
              <p className="text-sm text-muted-foreground">B2B invoices processed</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="flex gap-4 p-5">
            <ShieldCheck className="h-8 w-8 shrink-0 text-risk-safe" aria-hidden />
            <div>
              <p className="text-4xl font-semibold text-risk-safe">
                {summary.matchedCount}
              </p>
              <p className="text-sm text-risk-safe">
                {formatINR(summary.totalITCSafe)} safe to claim
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="flex gap-4 p-5">
            <AlertTriangle className="h-8 w-8 shrink-0 text-risk-medium" aria-hidden />
            <div>
              <p className="text-4xl font-semibold text-risk-medium">{issuesCount}</p>
              <p className="text-sm text-muted-foreground">Issues Found</p>
              <p className="text-sm text-risk-medium">
                {formatINR(summary.totalITCAtRisk)} at risk
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="flex gap-4 p-5">
            <FileX className="h-8 w-8 shrink-0 text-risk-high" aria-hidden />
            <div>
              <p className="text-4xl font-semibold text-risk-high">{missingOnly}</p>
              <p className="text-xs text-muted-foreground">
                2B only: {in2BOnlyDisplay} &nbsp;|&nbsp; PR only: {inPROnlyDisplay}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-l-4 border-l-risk-critical border-border shadow-sm md:col-span-3 lg:col-span-4">
          <CardContent className="flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <AlertOctagon className="h-10 w-10 shrink-0 text-risk-critical" aria-hidden />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-risk-critical">
                  Total ITC At Risk
                </p>
                <p className="text-4xl font-bold text-risk-critical">
                  {formatINR(summary.totalITCAtRisk)}
                </p>
                <p className="text-sm text-risk-critical">Requires immediate attention</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {(summary.qrmpCount ?? 0) > 0 ? (
        <Card className="border border-blue-100 border-l-4 border-l-blue-500 bg-[#EFF6FF] shadow-sm">
          <CardContent className="flex gap-4 p-5">
            <Clock className="h-8 w-8 shrink-0 text-blue-600" aria-hidden />
            <div>
              <p className="text-lg font-semibold text-blue-900">
                {summary.qrmpCount} QRMP supplier invoice{summary.qrmpCount === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-sm text-blue-900/90">
                These will appear in next quarter&apos;s GSTR-2B. No action needed.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {expiredCount > 0 || warningCount > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {expiredCount > 0 ? (
            <Card className="border border-red-200 border-l-4 border-l-red-600 bg-[#FEF2F2] shadow-sm">
              <CardContent className="flex gap-3 p-5">
                <span className="text-2xl" aria-hidden>
                  ⏰
                </span>
                <div>
                  <p className="text-sm font-semibold text-red-900">ITC Deadlines Expired</p>
                  <p className="mt-1 text-3xl font-bold text-red-800">{expiredCount}</p>
                  <p className="text-xs text-red-800/90">invoices past Section 16(4) limit</p>
                  <p className="mt-3 text-xs leading-relaxed text-red-900">
                    These ITC claims are permanently lost and cannot be recovered.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}
          {warningCount > 0 ? (
            <Card className="border border-amber-200 border-l-4 border-l-amber-500 bg-[#FFFBEB] shadow-sm">
              <CardContent className="flex gap-3 p-5">
                <span className="text-2xl" aria-hidden>
                  ⏰
                </span>
                <div>
                  <p className="text-sm font-semibold text-amber-950">ITC Deadlines Approaching</p>
                  <p className="mt-1 text-3xl font-bold text-amber-900">{warningCount}</p>
                  <p className="text-xs text-amber-900/90">invoices expiring within 60 days</p>
                  <p className="mt-3 text-xs leading-relaxed text-amber-950">
                    {nearestDeadlineLabel
                      ? `Act before ${nearestDeadlineLabel} to claim this ITC.`
                      : "Act before the deadline to claim this ITC."}
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {attention ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Attention required
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {showDup ? (
              <Card className="relative border-red-200 bg-red-50/80 py-1 shadow-sm">
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded p-1 text-red-700 hover:bg-red-100"
                  aria-label="Dismiss"
                  onClick={() => dismiss("dup")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <CardContent className="flex gap-2 p-3 pr-8">
                  <Copy className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-red-900">
                      {summary.duplicateCount} duplicate invoices found
                    </p>
                    <p className="text-xs text-red-800">
                      Remove duplicates to avoid double-claiming ITC.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {showTaxType ? (
              <Card className="relative border-amber-200 bg-amber-50/80 py-1 shadow-sm">
                <button
                  type="button"
                  className="absolute right-1 top-1 rounded p-1 text-amber-800 hover:bg-amber-100"
                  aria-label="Dismiss"
                  onClick={() => dismiss("taxType")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <CardContent className="flex gap-2 p-3 pr-8">
                  <span className="mt-0.5 text-sm font-bold text-amber-900" aria-hidden>
                    ↔
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-amber-950">
                      {summary.taxTypeMismatchCount} tax type mismatches
                    </p>
                    <p className="text-xs text-amber-900">
                      Total tax matches but IGST vs CGST/SGST classification differs.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
