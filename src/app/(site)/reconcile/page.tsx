"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowRight, Building2, CalendarDays, Download, RefreshCw } from "lucide-react"

import { FileUpload } from "@/components/reconcile/FileUpload"
import { GateModal } from "@/components/reconcile/GateModal"
import { GuestPromoBanner } from "@/components/reconcile/GuestPromoBanner"
import { MonthPicker } from "@/components/reconcile/MonthPicker"
import { ProcessingState } from "@/components/reconcile/ProcessingState"
import { RequestIdBanner } from "@/components/reconcile/RequestIdBanner"
import { GSTR3BSummary } from "@/components/reconcile/GSTR3BSummary"
import { ReconciliationTable } from "@/components/reconcile/ReconciliationTable"
import { SummaryCards } from "@/components/reconcile/SummaryCards"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAppConfig } from "@/hooks/useAppConfig"
import { useAuth } from "@/hooks/useAuth"
import { exportReconciliationWorkbook } from "@/lib/export"
import { useReconciliation } from "@/hooks/useReconciliation"
import { calculateGSTR3BSummary } from "@/lib/reconcile"
import { trackEvent } from "@/lib/analytics"
import { cn, getMonthName } from "@/lib/utils"

export default function ReconcilePage() {
  const router = useRouter()
  const { config, loading: configLoading } = useAppConfig()
  const { loading: authLoading, isAuthenticated, displayName } = useAuth()
  const [tryAgainBusy, setTryAgainBusy] = useState(false)
  const [newReconLoading, setNewReconLoading] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const {
    gstr2bParseResult,
    gstr2bRows,
    prParseResult,
    prRows,
    summary,
    results,
    filteredResults,
    activeFilters,
    activeUrgencies,
    month,
    year,
    setMonth,
    setYear,
    phase,
    error,
    requestId,
    handleGSTR2BFile,
    handlePRFile,
    runReconciliation,
    loadSampleData,
    setFilter,
    setUrgencyFilter,
    reset,
    clearGstr2b,
    clearPr,
    prPeriodMismatch,
    prPeriodMismatchDismissed,
    dismissPrPeriodMismatch,
    gstr2bFilePeriod,
    filePeriodMismatch,
    gstr2bFilePeriodMismatchVisible,
    switchToGstr2bFilePeriod,
    continueWithSelectedGstr2bPeriod,
    gstr2bPeriodContinueAnyway,
    volumeMismatch,
    showVolumeWarning,
    volumeMismatchDismissed,
    dismissVolumeWarningOnly,
    confirmVolumeAndReconcile,
    parsingTarget,
    sampleLoading,
    showGateModal,
    guestPromoVisible,
    dismissGuestPromo,
    guestReconciliationsUsed,
    guestReconciliationsLeft,
    freeReconciliationLimit,
  } = useReconciliation(config, { isAuthenticated })

  const gstrFilename = gstr2bParseResult?.filename ?? ""
  const gstrIsWorkbook = /\.(xlsx|xls|xlsm)$/i.test(gstrFilename)

  const gstr2bOk =
    gstr2bRows.length > 0 &&
    gstr2bParseResult?.validation?.isValid !== false &&
    !(gstrIsWorkbook && gstr2bParseResult?.validation?.hasB2BSheet === false)

  const prOk =
    prRows.length > 0 && prParseResult?.validation?.isValid !== false

  const ready = gstr2bOk && prOk

  const reconcileDisabledTitle = !ready
    ? (() => {
        const gVal = gstr2bParseResult?.validation
        if (gstrIsWorkbook && gVal?.hasB2BSheet === false) {
          return "GSTR-2B file is invalid — no B2B sheet found"
        }
        if (gVal?.isValid === false || prParseResult?.validation?.isValid === false) {
          return "Please upload the correct files"
        }
        if (!gstr2bRows.length || !prRows.length) {
          return "No invoices found in one or both files"
        }
        return "Upload both files to continue"
      })()
    : undefined

  const busy = phase === "reconciling"
  const reconciling = phase === "reconciling"

  const prPeriodWarningVisible =
    Boolean(prPeriodMismatch?.hasMismatch) &&
    !prPeriodMismatchDismissed &&
    prRows.length > 0

  const prPeriodReconcileHint =
    ready && Boolean(prPeriodMismatch?.hasMismatch) && !prPeriodMismatchDismissed

  const gstr2bFilePeriodReconcileHint =
    ready &&
    gstr2bPeriodContinueAnyway &&
    Boolean(gstr2bFilePeriod) &&
    filePeriodMismatch

  const volumeReconcileHint =
    ready &&
    volumeMismatch.hasMismatch &&
    !volumeMismatchDismissed

  const reconcilePeriodHint =
    prPeriodReconcileHint ||
    gstr2bFilePeriodReconcileHint ||
    volumeReconcileHint

  const volumeWarningBannerVisible =
    ready && volumeMismatch.hasMismatch && showVolumeWarning

  const gstr2bCount = gstr2bRows.length
  const prCount = prRows.length
  const volumeExcess =
    volumeMismatch.hasMismatch && gstr2bCount > prCount
      ? gstr2bCount - prCount
      : volumeMismatch.hasMismatch && prCount > gstr2bCount
        ? prCount - gstr2bCount
        : 0

  const reconcilePeriodTooltip = [
    prPeriodReconcileHint
      ? "Purchase Register has cross-period invoices. Click to proceed anyway."
      : null,
    gstr2bFilePeriodReconcileHint
      ? "GSTR-2B return period does not match the month you selected. Click to proceed anyway."
      : null,
    volumeReconcileHint
      ? "GSTR-2B and Purchase Register invoice counts differ greatly. Review or confirm below."
      : null,
  ]
    .filter(Boolean)
    .join(" ")

  const gstr3bSummary = useMemo(() => calculateGSTR3BSummary(results), [results])
  const gstr3bPeriodLabel = `${getMonthName(month)} ${year}`
  const periodLabel = `${getMonthName(month)} ${year}`
  const recipientGSTIN = gstr2bParseResult?.recipientGSTIN
  const customerLabel = gstr2bParseResult?.recipientName?.trim() || gstr2bParseResult?.recipientGSTIN

  function onExport() {
    if (!summary || !results.length || !requestId) return
    setExportBusy(true)
    window.setTimeout(() => {
      try {
        exportReconciliationWorkbook({
          month,
          year,
          requestId,
          gstr2bFilename: gstr2bParseResult?.filename ?? "",
          prFilename: prParseResult?.filename ?? "",
          summary,
          rows: results,
        })
        trackEvent("report-downloaded")
      } finally {
        setExportBusy(false)
      }
    }, 0)
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-4">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-brand-blue border-t-transparent"
          aria-hidden
        />
        <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10 lg:px-8">
      {showGateModal ? <GateModal /> : null}

      {gstr2bFilePeriodMismatchVisible && gstr2bFilePeriod ? (
        <div
          className="fixed inset-0 z-[90] flex items-stretch justify-center bg-black/50 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gstr2b-period-mismatch-title"
        >
          <div className="flex w-full max-w-md flex-col overflow-y-auto rounded-none border-t-4 border-brand-blue bg-white shadow-xl dark:border-brand-blue dark:bg-card md:max-h-[min(640px,90vh)] md:rounded-xl">
            <div className="p-6 pt-5">
              <div className="flex justify-center">
                <CalendarDays className="size-8 text-brand-blue" aria-hidden />
              </div>
              <h2
                id="gstr2b-period-mismatch-title"
                className="mt-4 text-center text-lg font-semibold text-brand-navy dark:text-foreground"
              >
                Period Mismatch
              </h2>
              <p className="mt-3 text-center text-sm text-muted-foreground">
                You selected:{" "}
                <span className="text-foreground">
                  {getMonthName(month)} {year}
                </span>
              </p>
              <p className="mt-2 text-center text-sm">
                <span className="text-muted-foreground">This file is:</span>{" "}
                <span className="font-semibold text-brand-navy dark:text-foreground">
                  {getMonthName(gstr2bFilePeriod.month)} {gstr2bFilePeriod.year}
                </span>
              </p>
              <div className="mt-6 flex flex-col gap-3">
                <Button
                  type="button"
                  size="lg"
                  className="h-11 w-full bg-brand-blue font-semibold text-white hover:bg-brand-blue/90"
                  onClick={() => switchToGstr2bFilePeriod()}
                >
                  Switch to {getMonthName(gstr2bFilePeriod.month)} {gstr2bFilePeriod.year}
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="h-11 w-full border-border font-medium"
                  onClick={() => continueWithSelectedGstr2bPeriod()}
                >
                  Continue with {getMonthName(month)} {year}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-4 border-b border-border pb-8 md:flex-row md:items-start md:justify-between md:gap-6">
        <div>
          <h1 className="text-3xl font-bold text-brand-navy md:text-[28px] lg:text-[30px]">
            GSTR-2B Reconciliation
          </h1>
          <p className="mt-1 text-muted-foreground">
            B2B Invoices — {getMonthName(month)} {year}
          </p>
        </div>
        <div className="hidden shrink-0 md:block">
          <MonthPicker
            month={month}
            year={year}
            onChange={({ month: m, year: y }) => {
              setMonth(m)
              setYear(y)
            }}
          />
        </div>
      </div>

      {config.maintenanceMode ? (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <p className="font-semibold">Maintenance mode is on.</p>
          <p className="mt-2 text-sm">
            Reconciliation is temporarily unavailable. Please try again later.
          </p>
        </div>
      ) : null}

      {busy ? (
        <div className="mt-10">
          <ProcessingState />
        </div>
      ) : null}

      {!busy && phase !== "done" && phase !== "error" ? (
        <div className="mt-10 space-y-8">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-brand-navy">
                  <span className="h-2 w-2 rounded-full bg-brand-blue" aria-hidden />
                  GSTR-2B File
                </CardTitle>
                <p className="text-sm text-muted-foreground">Downloaded from GSTN portal</p>
              </CardHeader>
              <CardContent>
                <FileUpload
                  label="GSTR-2B export"
                  subtitle="Excel, CSV, or official JSON from GSTN"
                  accentClass="text-brand-blue"
                  uploading={parsingTarget === "gstr2b"}
                  parseResult={gstr2bParseResult}
                  rowCount={gstr2bRows.length}
                  fileKind="gstr2b"
                  onFile={handleGSTR2BFile}
                  onClear={clearGstr2b}
                  volumeCountHighlight={
                    ready &&
                    volumeMismatch.hasMismatch &&
                    gstr2bCount < prCount
                  }
                />
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-brand-navy">
                  <span className="h-2 w-2 rounded-full bg-risk-safe" aria-hidden />
                  Purchase Register
                </CardTitle>
                <p className="text-sm text-muted-foreground">From your accounting software</p>
              </CardHeader>
              <CardContent>
                <FileUpload
                  label="Purchase register"
                  subtitle="Excel or CSV from Tally / Zoho / Busy"
                  accentClass="text-risk-safe"
                  uploading={parsingTarget === "pr"}
                  parseResult={prParseResult}
                  rowCount={prRows.length}
                  fileKind="pr"
                  onFile={handlePRFile}
                  onClear={clearPr}
                  volumeCountHighlight={
                    ready &&
                    volumeMismatch.hasMismatch &&
                    prCount < gstr2bCount
                  }
                />
              </CardContent>
            </Card>
          </div>

          <div className="md:hidden">
            <MonthPicker
              month={month}
              year={year}
              onChange={({ month: m, year: y }) => {
                setMonth(m)
                setYear(y)
              }}
            />
          </div>

          {volumeWarningBannerVisible ? (
            <div
              role="alert"
              className="rounded-lg border border-amber-300 bg-[#FFFBEB] p-4 text-amber-950 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/25 dark:text-amber-50"
            >
              <div className="flex gap-3">
                <AlertTriangle
                  className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
                  aria-hidden
                />
                <div className="min-w-0 flex-1 space-y-3 text-[13px] leading-snug">
                  <p className="font-semibold text-amber-900 dark:text-amber-50">
                    Large Volume Difference
                  </p>
                  <div className="space-y-1.5 rounded-md border border-amber-200/80 bg-white/60 px-3 py-2 dark:border-amber-800/50 dark:bg-amber-950/40">
                    <p className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-muted-foreground dark:text-amber-100/80">
                        GSTR-2B:
                      </span>
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          volumeMismatch.hasMismatch && gstr2bCount < prCount
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-brand-blue dark:text-blue-300",
                        )}
                      >
                        {gstr2bCount} invoices
                      </span>
                    </p>
                    <p className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-muted-foreground dark:text-amber-100/80">
                        Purchase Register:
                      </span>
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          volumeMismatch.hasMismatch && prCount < gstr2bCount
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-emerald-700 dark:text-emerald-300",
                        )}
                      >
                        {prCount} invoices
                      </span>
                    </p>
                  </div>
                  {volumeMismatch.message ? (
                    <p className="whitespace-pre-line text-amber-900/95 dark:text-amber-50/95">
                      {volumeMismatch.message}
                    </p>
                  ) : null}
                  <p className="text-amber-900/90 dark:text-amber-50/90">
                    {gstr2bCount > prCount ? (
                      <>
                        Your Purchase Register may be incomplete. This will result in many
                        &quot;In 2B Only&quot; rows
                        {volumeExcess > 0 ? ` (about ${volumeExcess}+).` : "."}
                      </>
                    ) : (
                      <>
                        Your GSTR-2B may be incomplete or filtered. This will result in many
                        &quot;In PR Only&quot; rows
                        {volumeExcess > 0 ? ` (about ${volumeExcess}+).` : "."}
                      </>
                    )}
                  </p>
                  <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-brand-blue font-medium text-white hover:bg-brand-blue/90 sm:flex-1"
                      onClick={() => void confirmVolumeAndReconcile()}
                    >
                      Yes, reconcile anyway
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-amber-400 bg-white font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-50 dark:hover:bg-amber-900/60 sm:flex-1"
                      onClick={() => dismissVolumeWarningOnly()}
                    >
                      Let me check my files first
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {prPeriodWarningVisible && prPeriodMismatch?.message ? (
            <div
              role="alert"
              className="rounded-lg border border-amber-300 bg-amber-50/90 p-4 text-amber-950 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100"
            >
              <div className="flex gap-3">
                <AlertTriangle
                  className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400"
                  aria-hidden
                />
                <div className="min-w-0 flex-1 space-y-2 text-[13px] leading-snug">
                  <p className="font-semibold text-amber-900 dark:text-amber-50">
                    Period Mismatch Detected
                  </p>
                  <p className="whitespace-pre-line text-amber-900/95 dark:text-amber-50/95">
                    {prPeriodMismatch.message}
                  </p>
                  <p className="text-amber-900/90 dark:text-amber-50/90">
                    These will appear as &quot;In PR Only&quot;. This may be intentional if your
                    supplier filed late.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-amber-400 bg-white text-[13px] text-amber-950 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-50 dark:hover:bg-amber-900/60"
                      onClick={() => dismissPrPeriodMismatch()}
                    >
                      Continue anyway
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-amber-400 bg-transparent text-[13px] text-amber-950 hover:bg-amber-100/80 dark:border-amber-600 dark:text-amber-50 dark:hover:bg-amber-900/40"
                      onClick={() => clearPr()}
                    >
                      Let me check first
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="text-center">
            {config.showSampleDataButton ? (
              <button
                type="button"
                disabled={sampleLoading}
                onClick={loadSampleData}
                className={cn(
                  "inline-flex min-w-[200px] items-center justify-center gap-2 text-sm font-medium text-muted-foreground underline-offset-2 hover:text-brand-navy hover:underline",
                  "disabled:pointer-events-none disabled:opacity-70",
                )}
              >
                {sampleLoading ? (
                  <>
                    <span
                      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden
                    />
                    Loading...
                  </>
                ) : (
                  "Load Sample Data →"
                )}
              </button>
            ) : null}
          </div>

          {!ready ? (
            <Button
              type="button"
              size="lg"
              title={reconcileDisabledTitle}
              disabled={!ready || configLoading || reconciling}
              onClick={() => void runReconciliation()}
              className={cn(
                "relative w-full py-6 text-base font-semibold disabled:pointer-events-none disabled:opacity-70",
                "bg-brand-blue text-white opacity-80",
              )}
            >
              <span className="inline-flex min-w-[min(100%,320px)] items-center justify-center gap-2">
                Upload both files to continue
              </span>
            </Button>
          ) : (
            <div className="space-y-1">
              <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    size="lg"
                    disabled={configLoading || reconciling}
                    onClick={() => void runReconciliation()}
                    className={cn(
                      "relative w-full py-6 text-base font-semibold disabled:pointer-events-none disabled:opacity-70",
                      !reconciling
                        ? "animate-pulse border-2 border-brand-blue/40 bg-brand-blue text-white hover:bg-brand-blue/90"
                        : "bg-brand-blue text-white opacity-80",
                    )}
                  >
                    {reconcilePeriodHint ? (
                      <span
                        className="pointer-events-none absolute top-2.5 right-3 size-2 rounded-full bg-amber-400 shadow-[0_0_0_2px_rgb(255,255,255)] dark:shadow-[0_0_0_2px_rgb(30,58,138)]"
                        aria-hidden
                      />
                    ) : null}
                    <span className="inline-flex min-w-[min(100%,320px)] items-center justify-center gap-2">
                      {reconciling ? (
                        <>
                          <span
                            className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent"
                            aria-hidden
                          />
                          Reconciling...
                        </>
                      ) : (
                        <>
                          Reconcile Now
                          <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
                        </>
                      )}
                    </span>
                  </Button>
                }
              />
              {reconcilePeriodHint ? (
                <TooltipContent
                  side="top"
                  className="max-w-[280px] border-amber-200 bg-amber-50 text-[13px] text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-50"
                >
                  {reconcilePeriodTooltip}
                </TooltipContent>
              ) : null}
              </Tooltip>
              {!isAuthenticated &&
              guestReconciliationsLeft < 10 ? (
                <p className="text-center text-xs text-slate-400">
                  {guestReconciliationsLeft} free reconciliations remaining
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {phase === "done" && summary && requestId ? (
        <div className="mt-10 space-y-6">
          <div className="md:hidden">
            <MonthPicker
              month={month}
              year={year}
              onChange={({ month: m, year: y }) => {
                setMonth(m)
                setYear(y)
              }}
            />
          </div>
          <RequestIdBanner requestId={requestId} />
          {guestPromoVisible ? (
            <GuestPromoBanner
              onDismiss={dismissGuestPromo}
              used={guestReconciliationsUsed}
              limit={freeReconciliationLimit}
            />
          ) : null}
          {results.length > 0 ? (
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 space-y-3">
                <h2 className="font-mono text-2xl font-bold text-brand-navy">{requestId}</h2>
                <p className="text-sm text-slate-500">{periodLabel} — B2B reconciliation</p>
                {recipientGSTIN && customerLabel ? (
                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard/customers/${encodeURIComponent(recipientGSTIN)}`)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
                  >
                    <Building2 size={12} />
                    {customerLabel}
                  </button>
                ) : null}
              </div>
              <div className="flex w-full flex-col gap-3 md:w-auto md:items-end">
                <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
                  <button
                    type="button"
                    disabled={newReconLoading}
                    onClick={() => {
                      setNewReconLoading(true)
                      router.push("/reconcile")
                    }}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700",
                      newReconLoading && "cursor-not-allowed opacity-70",
                    )}
                  >
                    {newReconLoading ? (
                      <span
                        className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent"
                        aria-hidden
                      />
                    ) : (
                      <RefreshCw size={16} aria-hidden />
                    )}
                    {newReconLoading ? "Starting..." : "New Reconciliation"}
                  </button>
                  <button
                    type="button"
                    disabled={exportBusy}
                    onClick={() => onExport()}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50",
                      exportBusy && "cursor-not-allowed opacity-70",
                    )}
                  >
                    {exportBusy ? (
                      <span
                        className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                        aria-hidden
                      />
                    ) : (
                      <Download size={16} aria-hidden />
                    )}
                    {exportBusy ? "Generating..." : "Download Excel"}
                  </button>
                </div>
                <p className="text-right text-xs text-slate-400">
                  Start a new reconciliation for any client and period
                </p>
              </div>
            </div>
          ) : null}
          <SummaryCards summary={summary} results={results} />
          {results.length > 0 ? (
            <GSTR3BSummary summary={gstr3bSummary} period={gstr3bPeriodLabel} />
          ) : null}
          <div className="min-w-0">
            <ReconciliationTable
              rows={filteredResults}
              filterBar={{
                results,
                  activeFilters,
                  activeUrgencies,
                onChange: setFilter,
                  onUrgencyChange: setUrgencyFilter,
              }}
              vendorMessage={{
                period: `${getMonthName(month)} ${year}`,
                caName:
                  isAuthenticated && displayName?.trim() ? displayName.trim() : undefined,
              }}
            />
          </div>
        </div>
      ) : null}

      {phase === "error" ? (
        <div className="mt-10">
          <Card className="border-red-200 bg-red-50/80">
            <CardHeader>
              <CardTitle className="text-lg text-red-900">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-red-900">{error}</p>
              <Button
                type="button"
                disabled={tryAgainBusy}
                onClick={() => {
                  setTryAgainBusy(true)
                  window.requestAnimationFrame(() => {
                    reset()
                    setTryAgainBusy(false)
                  })
                }}
                className="disabled:pointer-events-none disabled:opacity-70"
              >
                <span className="inline-flex min-w-[140px] items-center justify-center gap-2">
                  {tryAgainBusy ? (
                    <>
                      <span
                        className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                        aria-hidden
                      />
                      Please wait...
                    </>
                  ) : (
                    "Try Again"
                  )}
                </span>
              </Button>
            </CardContent>
          </Card>
          {summary && results.length ? (
            <div className="mt-8 space-y-4">
              <div className="md:hidden">
                <MonthPicker
                  month={month}
                  year={year}
                  onChange={({ month: m, year: y }) => {
                    setMonth(m)
                    setYear(y)
                  }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Your last reconciliation is still shown below. Download the Excel report to
                keep a copy.
              </p>
              {requestId ? <RequestIdBanner requestId={requestId} /> : null}
              {guestPromoVisible ? (
                <GuestPromoBanner
                  onDismiss={dismissGuestPromo}
                  used={guestReconciliationsUsed}
                  limit={freeReconciliationLimit}
                />
              ) : null}
              <SummaryCards summary={summary} results={results} />
              {results.length > 0 ? (
                <GSTR3BSummary summary={gstr3bSummary} period={gstr3bPeriodLabel} />
              ) : null}
              <div className="space-y-4">
                <button
                  type="button"
                  disabled={exportBusy}
                  onClick={() => onExport()}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50",
                    exportBusy && "cursor-not-allowed opacity-70",
                  )}
                >
                  {exportBusy ? (
                    <span
                      className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden
                    />
                  ) : (
                    <Download size={16} aria-hidden />
                  )}
                  {exportBusy ? "Generating..." : "Download Excel"}
                </button>
                <ReconciliationTable
                  rows={filteredResults}
                  filterBar={{
                    results,
                    activeFilters,
                    onChange: setFilter,
                    activeUrgencies,
                    onUrgencyChange: setUrgencyFilter,
                  }}
                  vendorMessage={{
                    period: `${getMonthName(month)} ${year}`,
                    caName:
                      isAuthenticated && displayName?.trim() ? displayName.trim() : undefined,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
