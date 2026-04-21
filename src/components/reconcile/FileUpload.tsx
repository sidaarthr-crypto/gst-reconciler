"use client"

import { useRef, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  Loader2,
  TriangleAlert,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { FileValidationConfidence, FileValidationResult, ParseResult } from "@/lib/types"

function mergeValidation(
  parseResult: ParseResult<unknown>,
  fileKind: "gstr2b" | "pr",
  effectiveCount: number,
): FileValidationResult {
  const defaults: FileValidationResult = {
    isValid: true,
    confidence: "high",
    warnings: [],
    errors: [],
    info: [],
    foundSheets: [],
    hasB2BSheet: fileKind === "gstr2b",
    b2bRowCount: effectiveCount,
    skippedRowCount: parseResult.skipped ?? 0,
    totalRowsParsed: parseResult.totalParsed ?? effectiveCount,
  }
  return { ...defaults, ...(parseResult.validation ?? {}) }
}

function confidenceTone(
  confidence: FileValidationConfidence,
  fileKind: "gstr2b" | "pr",
): { border: string; bg: string; icon: string } {
  if (confidence === "high") {
    return {
      border: "border-emerald-400",
      bg: "bg-emerald-50/80",
      icon: "text-emerald-600",
    }
  }
  if (fileKind === "gstr2b") {
    return {
      border: "border-amber-400",
      bg: "bg-amber-50/90",
      icon: "text-amber-600",
    }
  }
  return {
    border: "border-amber-400",
    bg: "bg-amber-50/90",
    icon: "text-amber-600",
  }
}

function isB2bSheetPill(name: string): boolean {
  const u = name.trim().toUpperCase()
  return u === "B2B" || u.includes("B2B")
}

export function FileUpload({
  label,
  subtitle,
  accentClass,
  uploading,
  parseResult,
  rowCount,
  fileKind,
  onFile,
  onClear,
  volumeCountHighlight,
}: {
  label: string
  subtitle: string
  accentClass: string
  uploading: boolean
  parseResult: ParseResult<unknown> | null
  rowCount: number
  fileKind: "gstr2b" | "pr"
  onFile: (file: File) => Promise<void>
  onClear: () => void
  /** When true, invoice count badge uses amber and a warning marker (large GSTR-2B vs PR gap). */
  volumeCountHighlight?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pickerBusy, setPickerBusy] = useState(false)
  const [removeBusy, setRemoveBusy] = useState(false)

  const effectiveCount = parseResult?.rowCount ?? rowCount
  const validation = parseResult?.validation

  const validationBlocked = Boolean(validation && !validation.isValid)
  const parseFatal =
    parseResult &&
    effectiveCount === 0 &&
    parseResult.errors.length > 0 &&
    !validation

  const parseWarningsCount = (parseResult?.errors ?? []).filter((e) =>
    e.toLowerCase().startsWith("warning"),
  ).length

  async function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ""
    setPickerBusy(false)
    if (f) await onFile(f)
  }

  function openPicker() {
    setPickerBusy(true)
    inputRef.current?.click()
    window.setTimeout(() => setPickerBusy(false), 4000)
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) await onFile(f)
  }

  if (uploading) {
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-brand-blue bg-brand-blue-lt/50 px-4 py-8">
        <Loader2 className="h-8 w-8 animate-spin text-brand-blue" aria-hidden />
        <p className="text-sm font-medium text-brand-navy">Parsing file...</p>
        <Progress className="h-1.5 w-48" value={66} />
      </div>
    )
  }

  if (validationBlocked && parseResult && validation) {
    const displayName =
      parseResult.filename.length > 30
        ? `${parseResult.filename.slice(0, 27)}…`
        : parseResult.filename
    const gstrInvalidTitle =
      fileKind === "gstr2b" &&
      (validation.hasB2BSheet === false || validation.confidence === "low")

    return (
      <div className="flex min-h-[160px] flex-col justify-center gap-3 rounded-xl border border-dashed border-red-400 bg-red-50 px-4 py-5 text-left">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-7 w-7 shrink-0 text-red-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm font-medium text-brand-navy">{displayName}</p>
            <p className="mt-1 text-sm font-semibold text-red-900">
              {gstrInvalidTitle ? "✗ Not a valid GSTR-2B file" : "File verification failed"}
            </p>
            {effectiveCount > 0 ? (
              <p className="mt-1 text-xs text-red-800">
                {effectiveCount} row{effectiveCount === 1 ? "" : "s"} read — fix issues below or
                upload a different file.
              </p>
            ) : null}
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-red-900">
              {validation.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
        <button
          type="button"
          disabled={removeBusy}
          className="inline-flex min-w-[220px] items-center justify-end gap-2 self-end text-sm font-medium text-red-800 underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-70"
          onClick={() => {
            setRemoveBusy(true)
            window.requestAnimationFrame(() => {
              onClear()
              setRemoveBusy(false)
            })
          }}
        >
          {removeBusy ? "Removing…" : "× Remove and upload correct file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={onInputChange}
        />
      </div>
    )
  }

  if (parseFatal && parseResult) {
    const msg = parseResult.errors[0] ?? "Could not read this file."
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-red-300 bg-red-50 px-4 py-6 text-center">
        <AlertCircle className="h-8 w-8 text-red-600" aria-hidden />
        <p className="text-sm font-medium text-red-800">{msg}</p>
        <button
          type="button"
          disabled={pickerBusy}
          className="inline-flex min-w-[200px] items-center justify-center gap-2 text-sm font-medium text-brand-blue underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-70"
          onClick={openPicker}
        >
          {pickerBusy ? (
            <>
              <span
                className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden
              />
              Opening...
            </>
          ) : (
            "Choose another file"
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={onInputChange}
        />
      </div>
    )
  }

  const canShowSuccess =
    Boolean(parseResult && effectiveCount > 0 && !validationBlocked && !parseFatal)

  if (canShowSuccess && parseResult) {
    const v = mergeValidation(parseResult, fileKind, effectiveCount)
    const conf = v.confidence
    const displayName =
      parseResult.filename.length > 30
        ? `${parseResult.filename.slice(0, 27)}…`
        : parseResult.filename
    const tone = confidenceTone(conf, fileKind)

    if (fileKind === "pr") {
      const verifiedBadge =
        conf === "high"
          ? "✓ Verified purchase register"
          : conf === "medium"
            ? "Looks like a purchase register"
            : "Could not fully verify purchase register"
      const badgeClass =
        conf === "high"
          ? "bg-emerald-600 text-white hover:bg-emerald-600"
          : "border border-amber-600/40 bg-amber-100 text-amber-950 hover:bg-amber-100"

      return (
        <div
          className={cn(
            "flex min-h-[160px] flex-col justify-center gap-3 rounded-xl border border-dashed px-4 py-5",
            tone.border,
            tone.bg,
          )}
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className={cn("mt-0.5 h-7 w-7 shrink-0", tone.icon)} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-medium text-brand-navy">{displayName}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge
                  className={cn(
                    "font-medium",
                    volumeCountHighlight
                      ? "border border-amber-500 bg-[#FFFBEB] text-amber-950 hover:bg-[#FFFBEB]"
                      : "bg-brand-navy text-white hover:bg-brand-navy",
                  )}
                >
                  {effectiveCount} invoices found
                  {volumeCountHighlight ? " ⚠️" : ""}
                </Badge>
                <Badge variant="outline" className={cn("text-xs font-medium", badgeClass)}>
                  {verifiedBadge}
                </Badge>
              </div>
              {v.warnings.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-amber-950">
                  {v.warnings.map((w) => (
                    <li key={w} className="flex gap-1">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {parseWarningsCount > 0 ? (
                <p className="mt-2 flex items-center gap-1 text-xs text-amber-800">
                  <TriangleAlert className="h-4 w-4" aria-hidden />
                  {parseWarningsCount} warning{parseWarningsCount === 1 ? "" : "s"} from parsing
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            disabled={removeBusy}
            className="inline-flex min-w-[120px] items-center justify-end gap-2 self-end text-sm font-medium text-muted-foreground hover:text-brand-navy disabled:pointer-events-none disabled:opacity-70"
            onClick={() => {
              setRemoveBusy(true)
              window.requestAnimationFrame(() => {
                onClear()
                setRemoveBusy(false)
              })
            }}
          >
            {removeBusy ? (
              <>
                <span
                  className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />
                Removing...
              </>
            ) : (
              "× Remove"
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={onInputChange}
          />
        </div>
      )
    }

    const countBadgeClass = volumeCountHighlight
      ? "border border-amber-500 bg-[#FFFBEB] font-semibold text-amber-950 hover:bg-[#FFFBEB]"
      : conf === "high"
        ? "bg-brand-navy text-white hover:bg-brand-navy"
        : "border border-amber-700/50 bg-amber-100 text-amber-950 hover:bg-amber-100"

    return (
      <div
        className={cn(
          "flex min-h-[160px] flex-col justify-center gap-3 rounded-xl border border-dashed px-4 py-5",
          tone.border,
          tone.bg,
        )}
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className={cn("mt-0.5 h-7 w-7 shrink-0", tone.icon)} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm font-medium text-brand-navy">{displayName}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge className={cn("font-medium", countBadgeClass)}>
                {effectiveCount} B2B invoices found
                {volumeCountHighlight ? " ⚠️" : ""}
              </Badge>
            </div>

            {conf === "high" ? (
              <div className="mt-3 rounded-lg border border-emerald-200/80 bg-white/80 px-3 py-2.5">
                <p className="text-xs font-semibold text-emerald-900">
                  ✓ Verified government GSTR-2B file
                </p>
                {v.foundSheets.length > 0 ? (
                  <p className="mt-1.5 text-[11px] font-medium text-muted-foreground">
                    Sheets detected:
                  </p>
                ) : null}
                {v.foundSheets.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {v.foundSheets.map((name) => (
                      <span
                        key={name}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px]",
                          isB2bSheetPill(name)
                            ? "bg-[#EFF6FF] font-semibold text-blue-800"
                            : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {name.trim()}
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  Processing B2B sheet only. B2BA, CDNR and other sheets are not processed in V1.
                </p>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-amber-200/90 bg-white/80 px-3 py-2.5">
                <p className="text-xs font-semibold text-amber-950">Looks like a GSTR-2B file</p>
                {v.warnings.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-amber-950">
                    {v.warnings.map((w) => (
                      <li key={w} className="flex gap-1">
                        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {v.foundSheets.length > 0 ? (
                  <>
                    <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                      Sheets detected:
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {v.foundSheets.map((name) => (
                        <span
                          key={name}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px]",
                            isB2bSheetPill(name)
                              ? "bg-[#EFF6FF] font-semibold text-blue-800"
                              : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {name.trim()}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  Processing B2B sheet only. B2BA, CDNR and other sheets are not processed in V1.
                </p>
              </div>
            )}

            {v.info.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {v.info.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}

            {parseWarningsCount > 0 ? (
              <p className="mt-2 flex items-center gap-1 text-xs text-amber-800">
                <TriangleAlert className="h-4 w-4" aria-hidden />
                {parseWarningsCount} warning{parseWarningsCount === 1 ? "" : "s"} from parsing
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          disabled={removeBusy}
          className="inline-flex min-w-[120px] items-center justify-end gap-2 self-end text-sm font-medium text-muted-foreground hover:text-brand-navy disabled:pointer-events-none disabled:opacity-70"
          onClick={() => {
            setRemoveBusy(true)
            window.requestAnimationFrame(() => {
              onClear()
              setRemoveBusy(false)
            })
          }}
        >
          {removeBusy ? (
            <>
              <span
                className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden
              />
              Removing...
            </>
          ) : (
            "× Remove"
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={onInputChange}
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={pickerBusy}
      onClick={openPicker}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
      className={cn(
        "group flex min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-2 px-4 py-8 text-center transition-colors",
        "hover:border-brand-blue hover:bg-brand-blue-lt/50",
        "disabled:pointer-events-none disabled:opacity-70",
      )}
    >
      <span
        className={cn(
          "mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-white text-muted-foreground shadow-sm ring-1 ring-border",
          accentClass,
        )}
      >
        <CloudUpload className="h-6 w-6" aria-hidden />
      </span>
      {pickerBusy ? (
        <span className="inline-flex items-center gap-2 text-sm font-medium text-brand-navy">
          <span
            className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden
          />
          Opening...
        </span>
      ) : (
        <span className="text-sm font-medium text-brand-navy">{label}</span>
      )}
      <span className="text-xs text-muted-foreground">{subtitle}</span>
      <span className="text-xs text-muted-foreground">Drag & drop or click to browse</span>
      <span className="text-[11px] text-muted-foreground">Accepts .xlsx and .csv</span>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={onInputChange}
      />
    </button>
  )
}
