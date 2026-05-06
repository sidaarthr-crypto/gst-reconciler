"use client"

import { useCallback, useMemo, useState } from "react"
import {
  AlarmClock,
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

  const hasQrmpRow = (summary.qrmpCount ?? 0) > 0
  const hasExpiredRow = expiredCount > 0
  const itcAtRiskOnlyRow2 = !hasQrmpRow && !hasExpiredRow

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="border-border shadow-sm">
          <CardContent className="flex gap-3 p-4 sm:gap-4 sm:p-5">
            <FileText className="h-7 w-7 shrink-0 text-brand-blue sm:h-8 sm:w-8" aria-hidden />
            <div className="min-w-0">
              <p className="text-2xl font-semibold tabular-nums text-brand-navy lg:text-4xl">
                {summary.totalInvoices}
              </p>
              <p className="text-xs text-muted-foreground sm:text-base">B2B invoices processed</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="flex gap-3 p-4 sm:gap-4 sm:p-5">
            <ShieldCheck className="h-7 w-7 shrink-0 text-risk-safe sm:h-8 sm:w-8" aria-hidden />
            <div className="min-w-0">
              <p className="text-2xl font-semibold tabular-nums text-risk-safe lg:text-4xl">
                {summary.matchedCount}
              </p>
              <p className="text-xs text-risk-safe sm:text-base">
                {formatINR(summary.totalITCSafe)} safe to claim
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="flex gap-3 p-4 sm:gap-4 sm:p-5">
            <AlertTriangle className="h-7 w-7 shrink-0 text-risk-medium sm:h-8 sm:w-8" aria-hidden />
            <div className="min-w-0">
              <p className="text-2xl font-semibold tabular-nums text-risk-medium lg:text-4xl">{issuesCount}</p>
              <p className="text-xs text-muted-foreground sm:text-base">Issues Found</p>
              <p className="text-xs text-risk-medium sm:text-base">
                {formatINR(summary.totalITCAtRisk)} at risk
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="flex gap-3 p-4 sm:gap-4 sm:p-5">
            <FileX className="h-7 w-7 shrink-0 text-risk-high sm:h-8 sm:w-8" aria-hidden />
            <div className="min-w-0">
              <p className="text-2xl font-semibold tabular-nums text-risk-high lg:text-4xl">{missingOnly}</p>
              <p className="text-xs text-muted-foreground">
                2B only: {in2BOnlyDisplay} &nbsp;|&nbsp; PR only: {inPROnlyDisplay}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card
          className={`min-h-[140px] border-border border-l-4 border-l-risk-critical shadow-sm ${itcAtRiskOnlyRow2 ? "sm:col-span-3" : ""}`}
        >
          <CardContent className="flex items-start gap-4 p-5">
            <AlertOctagon className="h-8 w-8 shrink-0 text-risk-critical" aria-hidden />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total ITC at risk
              </p>
              <p className="mt-1 text-3xl font-bold text-risk-critical md:text-4xl">
                {formatINR(summary.totalITCAtRisk)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Requires immediate attention</p>
            </div>
          </CardContent>
        </Card>

        {(summary.qrmpCount ?? 0) > 0 ? (
          <Card className="min-h-[140px] border-border border-l-4 border-l-blue-500 shadow-sm">
            <CardContent className="flex items-start gap-4 p-5">
              <Clock className="h-8 w-8 shrink-0 text-blue-600" aria-hidden />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  QRMP supplier invoices
                </p>
                <p className="mt-1 text-3xl font-bold text-blue-600 md:text-4xl">{summary.qrmpCount}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Will appear in next quarter&apos;s GSTR-2B
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {expiredCount > 0 ? (
          <Card className="min-h-[140px] border-border border-l-4 border-l-red-600 shadow-sm">
            <CardContent className="flex items-start gap-4 p-5">
              <AlarmClock className="h-8 w-8 shrink-0 text-red-600" aria-hidden />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  ITC deadlines expired
                </p>
                <p className="mt-1 text-3xl font-bold text-red-600 md:text-4xl">{expiredCount}</p>
                <p className="mt-1 text-sm text-muted-foreground">Invoices past Section 16(4) limit</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  These ITC claims are permanently lost
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {warningCount > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="min-h-[140px] border-border border-l-4 border-l-amber-500 shadow-sm">
            <CardContent className="flex items-start gap-4 p-5">
              <AlarmClock className="h-8 w-8 shrink-0 text-amber-600" aria-hidden />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  ITC deadlines approaching
                </p>
                <p className="mt-1 text-3xl font-bold text-amber-700 md:text-4xl">{warningCount}</p>
                <p className="mt-1 text-sm text-muted-foreground">Invoices expiring within 60 days</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {nearestDeadlineLabel
                    ? `Act before ${nearestDeadlineLabel} to claim this ITC.`
                    : "Act before the deadline to claim this ITC."}
                </p>
              </div>
            </CardContent>
          </Card>
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
                    <p className="text-base font-semibold text-red-900">
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
                    <p className="text-base font-semibold text-amber-950">
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
