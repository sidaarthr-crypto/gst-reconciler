"use client"

import { useState } from "react"
import { CheckCircle2, Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { exportReconciliationWorkbook } from "@/lib/export"
import type { ReconciliationRow, ReconciliationSummary } from "@/lib/types"

type ExportUiPhase = "idle" | "loading" | "done"

export function ExportButton({
  month,
  year,
  requestId,
  gstr2bFilename,
  prFilename,
  summary,
  rows,
  disabled,
}: {
  month: number
  year: number
  requestId: string | null
  gstr2bFilename: string
  prFilename: string
  summary: ReconciliationSummary | null
  rows: ReconciliationRow[]
  disabled?: boolean
}) {
  const [uiPhase, setUiPhase] = useState<ExportUiPhase>("idle")

  function onClick() {
    if (!summary || !requestId || !rows.length) return
    setUiPhase("loading")
    window.setTimeout(() => {
      try {
        exportReconciliationWorkbook({
          month,
          year,
          requestId,
          gstr2bFilename,
          prFilename,
          summary,
          rows,
        })
        setUiPhase("done")
        window.setTimeout(() => setUiPhase("idle"), 2000)
      } catch {
        setUiPhase("idle")
      }
    }, 0)
  }

  const off = disabled || !rows.length || !summary || !requestId
  const busy = uiPhase === "loading" || uiPhase === "done"

  return (
    <Button
      type="button"
      size="lg"
      variant="outline"
      disabled={off || busy}
      onClick={onClick}
      className="min-w-[260px] border-brand-navy text-brand-navy hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-70"
    >
      <span className="inline-flex items-center justify-center gap-2">
        {uiPhase === "loading" ? (
          <>
            <span
              className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden
            />
            Generating report...
          </>
        ) : uiPhase === "done" ? (
          <>
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <span className="text-emerald-700">Downloaded!</span>
          </>
        ) : (
          <>
            <Download className="h-4 w-4 shrink-0" aria-hidden />
            Download Excel Report
          </>
        )}
      </span>
    </Button>
  )
}
