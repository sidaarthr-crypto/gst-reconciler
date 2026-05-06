"use client"

import { useCallback, useState } from "react"
import { ChevronDown, Copy, Download } from "lucide-react"

import { cn, formatINR } from "@/lib/utils"
import type { GSTR3BSummary } from "@/lib/reconcile"

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function buildCopyText(period: string, s: GSTR3BSummary): string {
  return [
    `GSTR-3B Table 4A(5) — ${period}`,
    `IGST: ${formatINR(s.eligibleIGST)}`,
    `CGST: ${formatINR(s.eligibleCGST)}`,
    `SGST: ${formatINR(s.eligibleSGST)}`,
    `Total: ${formatINR(s.eligibleTotal)}`,
  ].join("\n")
}

function openPrintSummary(period: string, s: GSTR3BSummary): void {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>GSTR-3B ITC — ${esc(period)}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; color: #0f172a; }
  h1 { font-size: 18px; margin: 0 0 16px; }
  table { border-collapse: collapse; width: 100%; max-width: 640px; margin-bottom: 20px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
  th { font-size: 12px; text-transform: uppercase; color: #64748b; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .banner { margin-top: 24px; padding: 16px; background: #eff6ff; border-left: 4px solid #2563eb; font-size: 16px; font-weight: 700; }
  .muted { font-size: 12px; font-weight: 400; color: #475569; margin-top: 8px; }
</style></head><body>
  <h1>GSTR-3B ITC entry — ${esc(period)}</h1>
  <table>
    <tr><th colspan="2">Table 4A(5) — Eligible ITC (Matched, ITC available)</th></tr>
    <tr><td>IGST</td><td class="num">${esc(formatINR(s.eligibleIGST))}</td></tr>
    <tr><td>CGST</td><td class="num">${esc(formatINR(s.eligibleCGST))}</td></tr>
    <tr><td>SGST</td><td class="num">${esc(formatINR(s.eligibleSGST))}</td></tr>
    <tr><td><strong>Total</strong></td><td class="num"><strong>${esc(formatINR(s.eligibleTotal))}</strong></td></tr>
  </table>
  <table>
    <tr><th colspan="2">Table 4D(1) — Ineligible (ITC not available)</th></tr>
    <tr><td>IGST</td><td class="num">${esc(formatINR(s.ineligibleIGST))}</td></tr>
    <tr><td>CGST</td><td class="num">${esc(formatINR(s.ineligibleCGST))}</td></tr>
    <tr><td>SGST</td><td class="num">${esc(formatINR(s.ineligibleSGST))}</td></tr>
    <tr><td><strong>Total</strong></td><td class="num"><strong>${esc(formatINR(s.ineligibleTotal))}</strong></td></tr>
  </table>
  <table>
    <tr><th colspan="2">Deferred (not this month)</th></tr>
    <tr><td>Missing in 2B (PR only)</td><td class="num">${esc(formatINR(s.deferredTotal))}</td></tr>
    <tr><td>QRMP pending</td><td class="num">${esc(formatINR(s.qrmpTotal))}</td></tr>
  </table>
  <div class="banner">
    Net ITC for Table 4A(5): ${esc(formatINR(s.netClaimableTotal))}
    <div class="muted">IGST: ${esc(formatINR(s.netClaimableIGST))} &nbsp;|&nbsp; CGST: ${esc(formatINR(s.netClaimableCGST))} &nbsp;|&nbsp; SGST: ${esc(formatINR(s.netClaimableSGST))}</div>
  </div>
  <p style="margin-top:24px;font-size:11px;color:#64748b">Use your browser Print dialog and choose &quot;Save as PDF&quot; if required.</p>
</body></html>`
  const w = window.open("", "_blank", "noopener,noreferrer")
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.focus()
  window.setTimeout(() => {
    w.print()
    w.close()
  }, 200)
}

function MoneyRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-brand-navy">{formatINR(value)}</span>
    </div>
  )
}

export function GSTR3BSummary({ summary: s, period }: { summary: GSTR3BSummary; period: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const totalDeferred = s.deferredTotal + s.qrmpTotal

  const onCopy = useCallback(async () => {
    const text = buildCopyText(period, s)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }, [period, s])

  const onDownloadPdf = useCallback(() => {
    openPrintSummary(period, s)
  }, [period, s])

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between rounded-xl border border-border bg-white px-4 py-3 text-left shadow-sm transition-colors hover:bg-slate-50"
      >
        <span className="text-[15px] font-semibold text-brand-navy">GSTR-3B ITC Summary</span>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="rounded-xl border border-border bg-white px-5 py-5 shadow-sm sm:px-6 sm:py-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <h3 className="text-base font-semibold text-brand-navy">GSTR-3B ITC Entry for {period}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void onCopy()}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium shadow-sm",
                  copied
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-border bg-white text-brand-navy hover:bg-slate-50",
                )}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                {copied ? "✓ Copied!" : "Copy All"}
              </button>
              <button
                type="button"
                onClick={onDownloadPdf}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-brand-navy shadow-sm hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Download PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex flex-col rounded-lg border border-border">
              <div className="space-y-2 border-b border-border p-4">
                <p className="text-[13px] font-semibold text-emerald-700">✓ Claim in Table 4A(5)</p>
                <MoneyRow label="IGST:" value={s.eligibleIGST} />
                <MoneyRow label="CGST:" value={s.eligibleCGST} />
                <MoneyRow label="SGST:" value={s.eligibleSGST} />
                <div className="my-2 border-t border-border" />
                <div className="flex justify-between gap-3 text-sm font-bold text-emerald-800">
                  <span>Total:</span>
                  <span className="font-mono tabular-nums">{formatINR(s.eligibleTotal)}</span>
                </div>
              </div>
              <div className="mt-auto border-l-4 border-l-emerald-600 bg-[#F0FDF4] p-3 text-xs text-emerald-900/90">
                Eligible B2B ITC from matched invoices (ITC available = Y).
              </div>
            </div>

            <div className="flex flex-col rounded-lg border border-border">
              <div className="space-y-2 border-b border-border p-4">
                <p className="text-[13px] font-semibold text-red-700">✗ Do NOT Claim (Table 4D(1))</p>
                {s.ineligibleTotal === 0 ? (
                  <p className="text-sm font-medium text-emerald-700">{formatINR(0)} — All ITC eligible</p>
                ) : (
                  <>
                    <MoneyRow label="IGST:" value={s.ineligibleIGST} />
                    <MoneyRow label="CGST:" value={s.ineligibleCGST} />
                    <MoneyRow label="SGST:" value={s.ineligibleSGST} />
                    <div className="my-2 border-t border-border" />
                    <div className="flex justify-between gap-3 text-sm font-bold text-red-800">
                      <span>Total:</span>
                      <span className="font-mono tabular-nums">{formatINR(s.ineligibleTotal)}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="mt-auto border-l-4 border-l-red-600 bg-[#FEF2F2] p-3 text-xs text-red-900/90">
                Section 17(5) / blocked ITC per GSTR-2B (ITC available = N).
              </div>
            </div>

            <div className="flex flex-col rounded-lg border border-border">
              <div className="space-y-2 border-b border-border p-4">
                <p className="text-[13px] font-semibold text-amber-800">⏸ Deferred (claim next month)</p>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">Missing in 2B:</span>
                  <span className="font-mono tabular-nums font-medium text-orange-700">
                    {formatINR(s.deferredTotal)}
                  </span>
                </div>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">QRMP pending:</span>
                  <span className="font-mono tabular-nums font-medium text-blue-700">
                    {formatINR(s.qrmpTotal)}
                  </span>
                </div>
                <div className="my-2 border-t border-border" />
                <div className="flex justify-between gap-3 text-sm font-bold text-amber-900">
                  <span>Total deferred:</span>
                  <span className="font-mono tabular-nums">{formatINR(totalDeferred)}</span>
                </div>
              </div>
              <div className="mt-auto border-l-4 border-l-amber-500 bg-[#FFFBEB] p-3 text-xs text-amber-950/90">
                PR-only (not expired) and QRMP invoices — do not enter in this month&apos;s 4A(5).
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-blue-100 bg-[#EFF6FF] px-4 py-4 sm:px-5">
            <p className="text-base font-bold text-brand-navy sm:text-lg">
              Net ITC to enter in GSTR-3B Table 4A(5): {formatINR(s.netClaimableTotal)}
            </p>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground md:mt-1 md:flex md:flex-row md:flex-wrap md:gap-x-4 md:space-y-0 md:text-sm">
              <p>IGST: {formatINR(s.netClaimableIGST)}</p>
              <p>CGST: {formatINR(s.netClaimableCGST)}</p>
              <p>SGST: {formatINR(s.netClaimableSGST)}</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
