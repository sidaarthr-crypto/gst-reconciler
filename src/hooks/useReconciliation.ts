"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { parseGstr2bJson } from "@/lib/parseGstr2bJson"
import {
  ParseError,
  detectPeriodMismatch,
  parseGSTR2BFile,
  parsePurchaseRegisterFile,
} from "@/lib/parser"
import { reconcileB2B } from "@/lib/reconcile"
import {
  SAMPLE_MONTH,
  SAMPLE_YEAR,
  sampleGSTR2BRows,
  samplePurchaseRows,
} from "@/lib/sampleData"
import type {
  ActionUrgency,
  AppConfig,
  GSTR2BRow,
  ParseResult,
  PurchaseRegisterRow,
  ReconciliationFilterId,
  ReconciliationRow,
  ReconciliationSession,
  ReconciliationSummary,
} from "@/lib/types"
import {
  getGuestCount,
  incrementGuestCount,
  migrateGuestStorage,
} from "@/lib/guest-usage"
import { trackEvent } from "@/lib/analytics"
import { generateRequestId } from "@/lib/utils"

export type Phase =
  | "idle"
  | "uploading"
  | "reconciling"
  | "done"
  | "error"

export type ReconciliationAuthOptions = {
  isAuthenticated: boolean
}

export type RunReconciliationOptions = {
  /** Skip the GSTR-2B vs PR invoice-count guard (after user confirms in UI). */
  ignoreVolumeWarning?: boolean
}

export function checkVolumeMismatch(
  gstr2bCount: number,
  prCount: number,
): {
  hasMismatch: boolean
  ratio: number
  message: string | null
} {
  const min = Math.min(gstr2bCount, prCount)
  const max = Math.max(gstr2bCount, prCount)
  if (min <= 0) {
    return { hasMismatch: false, ratio: max > 0 ? Number.POSITIVE_INFINITY : 1, message: null }
  }
  const ratio = max / min
  if (ratio >= 3 && min > 5) {
    const larger = gstr2bCount > prCount ? "GSTR-2B" : "Purchase Register"
    const smaller = gstr2bCount > prCount ? "Purchase Register" : "GSTR-2B"
    const message = `${larger} has ${max} invoices but ${smaller} only has ${min}.\nYour ${smaller} may be incomplete.`
    return { hasMismatch: true, ratio, message }
  }
  return { hasMismatch: false, ratio, message: null }
}

export function useReconciliation(
  config: AppConfig,
  auth: ReconciliationAuthOptions,
) {

  const [gstr2bFile, setGstr2bFile] = useState<File | null>(null)
  const [gstr2bRows, setGstr2bRows] = useState<GSTR2BRow[]>([])
  const [gstr2bParseResult, setGstr2bParseResult] =
    useState<ParseResult<GSTR2BRow> | null>(null)

  const [prFile, setPrFile] = useState<File | null>(null)
  const [prRows, setPrRows] = useState<PurchaseRegisterRow[]>([])
  const [prParseResult, setPrParseResult] =
    useState<ParseResult<PurchaseRegisterRow> | null>(null)

  const [session, setSession] = useState<ReconciliationSession | null>(null)
  const [results, setResults] = useState<ReconciliationRow[]>([])
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null)

  const [activeFilters, setFilter] = useState<ReconciliationFilterId[]>([])
  const [activeUrgencies, setUrgencyFilter] = useState<ActionUrgency[]>([])
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [year, setYear] = useState(() => new Date().getFullYear())

  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)
  const [parsingTarget, setParsingTarget] = useState<"gstr2b" | "pr" | null>(null)
  const [sampleLoading, setSampleLoading] = useState(false)
  const [showGateModal, setShowGateModal] = useState(false)
  const [showGuestPromoBanner, setShowGuestPromoBanner] = useState(false)
  const [guestPromoDismissed, setGuestPromoDismissed] = useState(false)
  const [guestReconciliationsUsed, setGuestReconciliationsUsed] = useState(0)

  const freeReconciliationLimit = config.freeTierMaxReconciliations || 15
  const guestReconciliationsLeft = Math.max(
    0,
    freeReconciliationLimit - guestReconciliationsUsed,
  )

  useEffect(() => {
    if (auth.isAuthenticated) return
    migrateGuestStorage()
    setGuestReconciliationsUsed(getGuestCount())
  }, [auth.isAuthenticated])

  const [prPeriodMismatch, setPrPeriodMismatch] = useState<ReturnType<
    typeof detectPeriodMismatch
  > | null>(null)
  const [prPeriodMismatchDismissed, setPrPeriodMismatchDismissed] = useState(false)

  const [gstr2bFilePeriodMismatchDismissed, setGstr2bFilePeriodMismatchDismissed] =
    useState(false)
  const [gstr2bPeriodContinueAnyway, setGstr2bPeriodContinueAnyway] = useState(false)

  const [showVolumeWarning, setShowVolumeWarning] = useState(false)
  const [volumeMismatchDismissed, setVolumeMismatchDismissed] = useState(false)
  const volumeCountPrevRef = useRef({ g: 0, p: 0 })

  const gstr2bFilePeriod = useMemo(() => {
    const p = gstr2bParseResult
    if (
      p?.detectedMonth == null ||
      p?.detectedYear == null ||
      p.detectedMonth < 1 ||
      p.detectedMonth > 12
    ) {
      return null
    }
    return { month: p.detectedMonth, year: p.detectedYear }
  }, [gstr2bParseResult])

  const filePeriodMismatch = useMemo(
    () =>
      gstr2bFilePeriod != null &&
      (gstr2bFilePeriod.month !== month || gstr2bFilePeriod.year !== year),
    [gstr2bFilePeriod, month, year],
  )

  useEffect(() => {
    if (!prRows.length) {
      setPrPeriodMismatch(null)
      setPrPeriodMismatchDismissed(false)
      return
    }
    setPrPeriodMismatch(detectPeriodMismatch(prRows, month, year))
    setPrPeriodMismatchDismissed(false)
  }, [prRows, month, year])

  const volumeMismatch = useMemo(
    () => checkVolumeMismatch(gstr2bRows.length, prRows.length),
    [gstr2bRows.length, prRows.length],
  )

  useEffect(() => {
    const gc = gstr2bRows.length
    const pc = prRows.length
    if (!gc || !pc) {
      setShowVolumeWarning(false)
      setVolumeMismatchDismissed(false)
      volumeCountPrevRef.current = { g: gc, p: pc }
      return
    }
    if (!volumeMismatch.hasMismatch) {
      setShowVolumeWarning(false)
      setVolumeMismatchDismissed(false)
      volumeCountPrevRef.current = { g: gc, p: pc }
      return
    }
    const prev = volumeCountPrevRef.current
    const countsChanged = prev.g !== gc || prev.p !== pc
    volumeCountPrevRef.current = { g: gc, p: pc }
    if (countsChanged) {
      setVolumeMismatchDismissed(false)
      setShowVolumeWarning(true)
    }
  }, [gstr2bRows.length, prRows.length, volumeMismatch.hasMismatch])

  const filteredResults = useMemo(() => {
    return results.filter((row) => {
      const statusMatch =
        activeFilters.length === 0 ||
        activeFilters.some((filter) => {
          if (filter === "DeadlineWarning") return row.isDeadlineWarning && !row.isDeadlineExpired
          if (filter === "PosIssues") return row.isPOSMismatch
          if (filter === "All") return true
          return row.status === filter
        })
      const urgencyMatch =
        activeUrgencies.length === 0 || activeUrgencies.includes(row.actionUrgency)
      return statusMatch && urgencyMatch
    })
  }, [results, activeFilters, activeUrgencies])

  const handleGSTR2BFile = useCallback(
    async (file: File) => {
      setParsingTarget("gstr2b")
      setPhase("uploading")
      setError(null)
      setGstr2bFile(file)
      setGstr2bParseResult(null)
      setGstr2bRows([])
      setGstr2bFilePeriodMismatchDismissed(false)
      setGstr2bPeriodContinueAnyway(false)
      try {
        const parsed = file.name.toLowerCase().endsWith(".json")
          ? await parseGstr2bJson(file)
          : await parseGSTR2BFile(file)
        if (parsed.rowCount > config.maxFileRows) {
          throw new ParseError(
            `This file has ${parsed.rowCount} rows, which is more than the maximum of ${config.maxFileRows} rows allowed per upload. Please split the file or filter the export.`,
          )
        }
        if (parsed.rowCount > config.freeTierMaxRows) {
          parsed.errors.push(
            `This file exceeds the free tier limit of ${config.freeTierMaxRows} rows. Processing will continue for this demo.`,
          )
        }
        setGstr2bParseResult(parsed)
        setGstr2bRows(parsed.validation?.isValid === false ? [] : parsed.rows)
        if (parsed.validation?.isValid !== false) {
          trackEvent("file-uploaded", { type: "gstr2b" })
        }
      } catch (e) {
        const message =
          e instanceof ParseError
            ? e.message
            : "This file appears to be empty. Make sure you exported data rows from the portal."
        setGstr2bParseResult({
          rows: [],
          filename: file.name,
          rowCount: 0,
          errors: [message],
          detectedMonth: null,
          detectedYear: null,
        })
        setGstr2bFile(null)
        setGstr2bFilePeriodMismatchDismissed(false)
        setGstr2bPeriodContinueAnyway(false)
      } finally {
        setParsingTarget(null)
        setPhase("idle")
      }
    },
    [config.freeTierMaxRows, config.maxFileRows],
  )

  const handlePRFile = useCallback(
    async (file: File) => {
      setParsingTarget("pr")
      setPhase("uploading")
      setError(null)
      setPrFile(file)
      setPrParseResult(null)
      setPrRows([])
      try {
        const parsed = await parsePurchaseRegisterFile(file)
        if (parsed.rowCount > config.maxFileRows) {
          throw new ParseError(
            `This file has ${parsed.rowCount} rows, which is more than the maximum of ${config.maxFileRows} rows allowed per upload. Please split the file or filter the export.`,
          )
        }
        if (parsed.rowCount > config.freeTierMaxRows) {
          parsed.errors.push(
            `This file exceeds the free tier limit of ${config.freeTierMaxRows} rows. Processing will continue for this demo.`,
          )
        }
        setPrParseResult(parsed)
        setPrRows(parsed.validation?.isValid === false ? [] : parsed.rows)
        if (parsed.validation?.isValid !== false) {
          trackEvent("file-uploaded", { type: "purchase-register" })
        }
      } catch (e) {
        const message =
          e instanceof ParseError
            ? e.message
            : "This file appears to be empty. Make sure you exported data rows from the portal."
        setPrParseResult({
          rows: [],
          filename: file.name,
          rowCount: 0,
          errors: [message],
        })
        setPrFile(null)
      } finally {
        setParsingTarget(null)
        setPhase("idle")
      }
    },
    [config.freeTierMaxRows, config.maxFileRows],
  )

  const loadSampleData = useCallback(() => {
    setSampleLoading(true)
    window.setTimeout(() => {
      try {
        setGstr2bFile(new File([], "sample-gstr2b.csv"))
        setPrFile(new File([], "sample-purchase-register.csv"))
        setGstr2bRows(sampleGSTR2BRows)
        setPrRows(samplePurchaseRows)
        setGstr2bParseResult({
          rows: sampleGSTR2BRows,
          filename: "sample-gstr2b.csv",
          rowCount: sampleGSTR2BRows.length,
          totalParsed: sampleGSTR2BRows.length,
          skipped: 0,
          errors: [],
          recipientGSTIN: "27AABCU9603R1ZM",
          recipientName: "Sample Industries Pvt Ltd",
          returnPeriod: "April 2024",
          detectedMonth: SAMPLE_MONTH,
          detectedYear: SAMPLE_YEAR,
          validation: {
            isValid: true,
            confidence: "high",
            warnings: [],
            errors: [],
            info: [],
            foundSheets: ["B2B", "B2BA", "CDNR", "CDNRA", "Summary"],
            hasB2BSheet: true,
            b2bRowCount: sampleGSTR2BRows.length,
            skippedRowCount: 0,
            totalRowsParsed: sampleGSTR2BRows.length,
          },
        })
        setPrParseResult({
          rows: samplePurchaseRows,
          filename: "sample-purchase-register.csv",
          rowCount: samplePurchaseRows.length,
          errors: [],
          validation: {
            isValid: true,
            confidence: "high",
            warnings: [],
            errors: [],
            info: [],
            foundSheets: [],
            hasB2BSheet: false,
            b2bRowCount: 0,
            skippedRowCount: 0,
            totalRowsParsed: samplePurchaseRows.length,
          },
        })
        setMonth(SAMPLE_MONTH)
        setYear(SAMPLE_YEAR)
        setGstr2bFilePeriodMismatchDismissed(false)
        setGstr2bPeriodContinueAnyway(false)
        setShowVolumeWarning(false)
        setVolumeMismatchDismissed(false)
        volumeCountPrevRef.current = { g: 0, p: 0 }
        setError(null)
        setPhase("idle")
      } finally {
        setSampleLoading(false)
      }
    }, 0)
  }, [])

  const clearGstr2b = useCallback(() => {
    setGstr2bFile(null)
    setGstr2bRows([])
    setGstr2bParseResult(null)
    setGstr2bFilePeriodMismatchDismissed(false)
    setGstr2bPeriodContinueAnyway(false)
    setShowVolumeWarning(false)
    setVolumeMismatchDismissed(false)
    volumeCountPrevRef.current = { g: 0, p: 0 }
  }, [])

  const switchToGstr2bFilePeriod = useCallback(() => {
    const p = gstr2bParseResult
    if (p?.detectedMonth == null || p?.detectedYear == null) return
    setMonth(p.detectedMonth)
    setYear(p.detectedYear)
    setGstr2bFilePeriodMismatchDismissed(false)
    setGstr2bPeriodContinueAnyway(false)
  }, [gstr2bParseResult])

  const continueWithSelectedGstr2bPeriod = useCallback(() => {
    setGstr2bFilePeriodMismatchDismissed(true)
    setGstr2bPeriodContinueAnyway(true)
  }, [])

  const clearPr = useCallback(() => {
    setPrFile(null)
    setPrRows([])
    setPrParseResult(null)
    setShowVolumeWarning(false)
    setVolumeMismatchDismissed(false)
    volumeCountPrevRef.current = { g: 0, p: 0 }
  }, [])

  const reset = useCallback(() => {
    setGstr2bFile(null)
    setGstr2bRows([])
    setGstr2bParseResult(null)
    setPrFile(null)
    setPrRows([])
    setPrParseResult(null)
    setSession(null)
    setResults([])
    setSummary(null)
    setFilter([])
    setUrgencyFilter([])
    setPhase("idle")
    setError(null)
    setRequestId(null)
    setParsingTarget(null)
    setSampleLoading(false)
    setShowGateModal(false)
    setShowGuestPromoBanner(false)
    setGuestPromoDismissed(false)
    setPrPeriodMismatch(null)
    setPrPeriodMismatchDismissed(false)
    setGstr2bFilePeriodMismatchDismissed(false)
    setGstr2bPeriodContinueAnyway(false)
    setShowVolumeWarning(false)
    setVolumeMismatchDismissed(false)
    volumeCountPrevRef.current = { g: 0, p: 0 }
    const now = new Date()
    setMonth(now.getMonth() + 1)
    setYear(now.getFullYear())
  }, [])

  const dismissVolumeWarningOnly = useCallback(() => {
    setShowVolumeWarning(false)
  }, [])

  const runReconciliation = useCallback(async (opts?: RunReconciliationOptions) => {
    if (!gstr2bRows.length || !prRows.length) {
      setError(
        "Both files must have data before reconciling. Upload a valid GSTR-2B export and Purchase Register, or load the sample data.",
      )
      setPhase("error")
      return
    }

    if (gstr2bParseResult?.validation?.isValid === false) {
      setError("GSTR-2B file did not pass verification. Remove the file and upload a valid GSTN export.")
      setPhase("error")
      return
    }
    if (prParseResult?.validation?.isValid === false) {
      setError(
        "Purchase register did not pass verification. Remove the file and upload a valid purchase register export.",
      )
      setPhase("error")
      return
    }

    if (!auth.isAuthenticated && getGuestCount() >= freeReconciliationLimit) {
      setShowGateModal(true)
      return
    }

    const vol = checkVolumeMismatch(gstr2bRows.length, prRows.length)
    if (!opts?.ignoreVolumeWarning && vol.hasMismatch && !volumeMismatchDismissed) {
      setShowVolumeWarning(true)
      toast.info(
        "Large difference in invoice counts. Review the warning below, or choose \"Yes, reconcile anyway\".",
      )
      return
    }
    if (opts?.ignoreVolumeWarning) {
      setVolumeMismatchDismissed(true)
      setShowVolumeWarning(false)
    }

    setError(null)
    setPhase("reconciling")

    const rid = generateRequestId(config.requestIdPrefix)
    setRequestId(rid)

    try {
      const createRes = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          year,
          gstr2bFilename: gstr2bParseResult?.filename ?? gstr2bFile?.name ?? "",
          gstr2bRowCount: gstr2bRows.length,
          prFilename: prParseResult?.filename ?? prFile?.name ?? "",
          prRowCount: prRows.length,
          requestId: rid,
          clientGstin: gstr2bParseResult?.recipientGSTIN ?? null,
          clientName: gstr2bParseResult?.recipientName ?? null,
        }),
      })
      const created = (await createRes.json()) as {
        sessionId?: string
        requestId?: string
        error?: string
      }
      if (!createRes.ok || !created.sessionId) {
        throw new Error(
          created.error ??
            "We could not start a reconciliation session. Please check your internet connection and try again.",
        )
      }

      const selectedMonth = Number(month)
      const selectedYear = Number(year)

      const { rows, summary: sum } = await reconcileB2B(
        gstr2bRows,
        prRows,
        config,
        gstr2bParseResult?.recipientGSTIN ?? undefined,
        {
          month: selectedMonth,
          year: selectedYear,
        },
      )

      setResults(rows)
      setSummary(sum)
      trackEvent("reconciliation-completed", {
        matched: sum.matchedCount,
        mismatched: Math.max(0, sum.totalInvoices - sum.matchedCount),
        in_2b_only: sum.in2BOnlyCount,
        in_pr_only: sum.inPROnlyCount,
      })
      setSession({
        id: created.sessionId,
        requestId: rid,
        status: "completed",
        month,
        year,
        gstr2bFilename: gstr2bParseResult?.filename ?? "",
        gstr2bRowCount: gstr2bRows.length,
        prFilename: prParseResult?.filename ?? "",
        prRowCount: prRows.length,
        summary: sum,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      })
      await new Promise((r) => setTimeout(r, 450))
      setPhase("done")

      if (!auth.isAuthenticated) {
        const used = incrementGuestCount()
        setGuestReconciliationsUsed(used)
        setShowGuestPromoBanner(true)
        setGuestPromoDismissed(false)
      }

      void (async () => {
        try {
          const saveRes = await fetch(`/api/sessions/${created.sessionId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              requestId: rid,
              gstr2bRows,
              prRows,
              results: rows,
              summary: sum,
            }),
          })
          const saved = (await saveRes.json()) as { ok?: boolean; error?: string }
          if (!saveRes.ok) {
            const detail =
              typeof saved.error === "string" && saved.error.length > 0
                ? saved.error
                : `Request failed (${saveRes.status})`
            console.error("[sessions] background save failed:", detail)
            toast.error("Could not save reconciliation to your account", {
              description: `${detail} — your results on this page are still valid.`,
              duration: 8000,
            })
          }
        } catch (err) {
          console.error("[sessions] background save error:", err)
          toast.error("Could not save reconciliation to your account", {
            description:
              err instanceof Error ? err.message : "Network or server error while saving.",
            duration: 8000,
          })
        }
      })()
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : "Something went wrong while reconciling. Please try again in a few minutes."
      setError(message)
      setPhase("error")
      toast.error(message)
    }
  }, [
    config,
    gstr2bFile,
    gstr2bParseResult?.recipientGSTIN,
    gstr2bParseResult,
    gstr2bRows,
    month,
    prFile,
    prParseResult,
    prRows,
    year,
    auth.isAuthenticated,
    volumeMismatchDismissed,
    freeReconciliationLimit,
  ])

  const confirmVolumeAndReconcile = useCallback(() => {
    void runReconciliation({ ignoreVolumeWarning: true })
  }, [runReconciliation])

  return {
    gstr2bFile,
    gstr2bRows,
    gstr2bParseResult,
    prFile,
    prRows,
    prParseResult,
    session,
    results,
    summary,
    activeFilters,
    activeUrgencies,
    month,
    year,
    setMonth,
    setYear,
    phase,
    error,
    requestId,
    filteredResults,
    handleGSTR2BFile,
    handlePRFile,
    runReconciliation,
    loadSampleData,
    setFilter,
    setUrgencyFilter,
    reset,
    clearGstr2b,
    clearPr,
    parsingTarget,
    sampleLoading,
    showGateModal,
    showGuestPromoBanner,
    guestPromoVisible: showGuestPromoBanner && !guestPromoDismissed,
    dismissGuestPromo: () => setGuestPromoDismissed(true),
    guestReconciliationsUsed,
    guestReconciliationsLeft,
    freeReconciliationLimit,
    prPeriodMismatch,
    prPeriodMismatchDismissed,
    dismissPrPeriodMismatch: () => setPrPeriodMismatchDismissed(true),
    gstr2bFilePeriod,
    filePeriodMismatch,
    gstr2bFilePeriodMismatchVisible:
      filePeriodMismatch && !gstr2bFilePeriodMismatchDismissed,
    switchToGstr2bFilePeriod,
    continueWithSelectedGstr2bPeriod,
    gstr2bPeriodContinueAnyway,
    volumeMismatch,
    showVolumeWarning,
    volumeMismatchDismissed,
    dismissVolumeWarningOnly,
    confirmVolumeAndReconcile,
  }
}
