"use client"

import type { CSSProperties } from "react"
import { useState } from "react"
import { Copy, LayoutGrid, List } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { EmptyState } from "@/components/reconcile/EmptyState"
import { ActionBadge } from "@/components/reconcile/ActionBadge"
import { FilterBar } from "@/components/reconcile/FilterBar"
import { RiskBadge } from "@/components/reconcile/RiskBadge"
import { StatusBadge } from "@/components/reconcile/StatusBadge"
import { SupplierView } from "@/components/reconcile/SupplierView"
import { cn, formatDiff, formatINR, generateVendorMessage } from "@/lib/utils"
import type {
  ReconciliationFilterId,
  ReconciliationRow,
  VendorMessageContext,
} from "@/lib/types"

export type { VendorMessageContext }

export type ReconciliationTableFilterBarProps = {
  results: ReconciliationRow[]
  active: ReconciliationFilterId
  onChange: (next: ReconciliationFilterId) => void
}

function itcBadge(v: string | null) {
  if (!v) return <span className="text-muted-foreground">—</span>
  const cls =
    v === "Y"
      ? "bg-emerald-100 text-emerald-800"
      : v === "N"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-900"
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-xs font-semibold", cls)}>
      {v}
    </span>
  )
}

function rowBgClass(row: ReconciliationRow) {
  if (row.status === "Duplicate" || row.isDuplicate) return ""
  if (row.status === "QRMP Delay") return "bg-[#F8FAFC]"
  if (row.itcRisk === "Critical") return "bg-[#FFF8F8]"
  if (row.itcRisk === "High") return "bg-[#FFFAF5]"
  return "bg-white"
}

function rowBgStyle(row: ReconciliationRow): CSSProperties | undefined {
  if (row.status === "Duplicate" || row.isDuplicate) {
    return {
      backgroundImage:
        "repeating-linear-gradient(45deg, #FEF2F2, #FEF2F2 4px, #FFF5F5 4px, #FFF5F5 8px)",
    }
  }
  return undefined
}

function DeadlineCell({ row }: { row: ReconciliationRow }) {
  if (row.itcClaimDeadline == null) {
    return <span className="text-muted-foreground">—</span>
  }
  if (row.isDeadlineExpired) {
    return (
      <div className="leading-tight">
        <div className="text-xs font-semibold text-[#DC2626]">EXPIRED</div>
        <div className="text-xs text-[#DC2626]/90">{row.itcClaimDeadline}</div>
        <div className="text-xs text-[#DC2626]/80">
          ({Math.abs(row.daysToDeadline ?? 0)} days ago)
        </div>
      </div>
    )
  }
  if (row.isDeadlineWarning && !row.isDeadlineExpired) {
    return (
      <div className="leading-tight">
        <div className="text-xs font-semibold text-[#D97706]">
          {(row.daysToDeadline ?? 0).toString()} days left
        </div>
        <div className="text-xs text-[#D97706]">{row.itcClaimDeadline}</div>
      </div>
    )
  }
  return (
    <div className="leading-tight text-muted-foreground">
      <div className="text-xs">{row.itcClaimDeadline}</div>
      <div className="text-xs">({(row.daysToDeadline ?? 0).toString()} days)</div>
    </div>
  )
}

function CopyVendorMessageButton({
  row,
  vendorMessage,
}: {
  row: ReconciliationRow
  vendorMessage?: VendorMessageContext
}) {
  const [copied, setCopied] = useState(false)
  if (row.status === "Matched" || row.status === "QRMP Delay") return null

  const period = vendorMessage?.period?.trim() || "the relevant return period"
  const caName = vendorMessage?.caName

  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-11 items-center gap-0.5 border-0 bg-transparent p-0 text-left text-xs font-medium transition-colors md:min-h-0",
        copied ? "text-emerald-600" : "text-[#2563EB] hover:underline",
      )}
      onClick={async () => {
        const text = generateVendorMessage(row, period, caName)
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 2000)
        } catch {
          // Clipboard may be unavailable (non-secure context, permissions).
        }
      }}
    >
      {copied ? (
        "✓ Copied!"
      ) : (
        <>
          <Copy className="h-3 w-3 shrink-0" aria-hidden />
          Copy Message
        </>
      )}
    </button>
  )
}

function InvoiceTable({
  rows,
  vendorMessage,
}: {
  rows: ReconciliationRow[]
  vendorMessage?: VendorMessageContext
}) {
  const showDeadlineColumn = rows.some((r) => r.itcClaimDeadline != null)

  return (
    <div className="scroll-table-hint overflow-x-auto rounded-xl border border-border bg-white [-webkit-overflow-scrolling:touch]">
      <table
        className={cn(
          "w-full border-collapse text-xs md:text-sm",
          showDeadlineColumn ? "min-w-[2480px]" : "min-w-[2350px]",
        )}
      >
        <thead className="sticky top-0 z-10 bg-surface-2 text-left text-xs font-medium text-brand-navy shadow-[0_1px_0_0_var(--color-border)]">
          <tr>
            <th className="w-[80px] whitespace-nowrap px-2 py-2 md:static md:bg-transparent max-md:sticky max-md:left-0 max-md:z-30 max-md:bg-surface-2 max-md:shadow-[4px_0_12px_-6px_rgba(0,0,0,0.12)]">
              Risk
            </th>
            <th className="w-[130px] px-2 py-2 md:static md:bg-transparent max-md:sticky max-md:left-[80px] max-md:z-30 max-md:bg-surface-2 max-md:shadow-[4px_0_12px_-6px_rgba(0,0,0,0.12)]">
              Status
            </th>
            <th className="w-[160px] px-2 py-2">GSTIN</th>
            <th className="w-[160px] px-2 py-2">Supplier</th>
            <th className="w-[140px] px-2 py-2">Invoice No</th>
            <th className="w-[100px] px-2 py-2">Date</th>
            <th className="w-[60px] px-2 py-2">POS</th>
            <th className="w-[120px] px-2 py-2 text-right">Taxable 2B</th>
            <th className="w-[120px] px-2 py-2 text-right">Taxable PR</th>
            <th className="w-[100px] px-2 py-2 text-right">Taxable Diff</th>
            <th className="w-[100px] px-2 py-2 text-right">IGST 2B</th>
            <th className="w-[100px] px-2 py-2 text-right">IGST PR</th>
            <th className="w-[100px] px-2 py-2 text-right">CGST 2B</th>
            <th className="w-[100px] px-2 py-2 text-right">CGST PR</th>
            <th className="w-[100px] px-2 py-2 text-right">SGST 2B</th>
            <th className="w-[100px] px-2 py-2 text-right">SGST PR</th>
            <th className="w-[70px] px-2 py-2">ITC Avl</th>
            <th className="w-[80px] px-2 py-2 text-center">Tax Type</th>
            <th className="w-[120px] px-2 py-2 text-right">ITC At Risk</th>
            {showDeadlineColumn ? (
              <th className="w-[130px] px-2 py-2">
                <Tooltip>
                  <TooltipTrigger className="cursor-default border-0 bg-transparent p-0 text-left font-medium text-brand-navy">
                    ITC Deadline
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Last date to claim ITC under Section 16(4). Applies to invoices missing from
                    GSTR-2B.
                  </TooltipContent>
                </Tooltip>
              </th>
            ) : null}
            <th className="w-[250px] px-2 py-2">Recommended Action</th>
            <th className="w-[120px] px-2 py-2">Urgency</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const td = formatDiff(row.taxableDiff)
            const showTaxType = row.isTaxTypeMismatch || row.status === "Tax Type Mismatch"
            const isDupRow = row.status === "Duplicate" || row.isDuplicate
            const stickyCell = (extra?: string) =>
              cn(
                !isDupRow &&
                  "max-md:sticky max-md:z-20 max-md:shadow-[4px_0_12px_-8px_rgba(0,0,0,0.08)]",
                extra,
              )
            const deadlineTdClass = cn(
              "w-[130px] px-2 py-2 align-top text-xs",
              row.itcClaimDeadline != null &&
                row.isDeadlineExpired &&
                "bg-[#FEF2F2]",
              row.itcClaimDeadline != null &&
                row.isDeadlineWarning &&
                !row.isDeadlineExpired &&
                "bg-[#FFFBEB]",
            )
            return (
              <tr
                key={`${row.matchKey}-${row.invoiceNumber}-${idx}`}
                className={cn(
                  "border-t border-border transition-colors hover:bg-surface-2/80",
                  rowBgClass(row),
                )}
                style={rowBgStyle(row)}
              >
                <td
                  className={cn(
                    "px-2 py-2 align-top",
                    stickyCell("max-md:left-0"),
                    !isDupRow && rowBgClass(row),
                  )}
                >
                  <RiskBadge row={row} />
                </td>
                <td
                  className={cn(
                    "px-2 py-2 align-top",
                    stickyCell("max-md:left-[80px]"),
                    !isDupRow && rowBgClass(row),
                  )}
                >
                  <div className="flex flex-wrap items-center gap-1">
                    <StatusBadge status={row.status} />
                    {(row.isRCM || row.status === "RCM Invoice") && (
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-xs font-bold uppercase text-violet-800">
                        RCM
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 font-mono text-xs align-top">{row.supplierGSTIN}</td>
                <td className="max-w-[160px] truncate px-2 py-2 align-top" title={row.supplierName}>
                  {row.supplierName}
                </td>
                <td className="px-2 py-2 font-mono text-xs align-top">{row.invoiceNumber}</td>
                <td className="px-2 py-2 align-top">{row.invoiceDate}</td>
                <td className="px-2 py-2 align-top">{row.placeOfSupply}</td>
                <td className="px-2 py-2 text-right align-top tabular-nums">
                  {formatINR(row.taxable2B)}
                </td>
                <td className="px-2 py-2 text-right align-top tabular-nums">
                  {formatINR(row.taxablePR)}
                </td>
                <td
                  className={cn(
                    "px-2 py-2 text-right align-top tabular-nums text-xs font-medium",
                    td.isPositive && "text-emerald-700",
                    td.isNegative && "text-red-700",
                    !td.isPositive && !td.isNegative && "text-muted-foreground",
                  )}
                >
                  {td.text}
                </td>
                <td className="px-2 py-2 text-right align-top tabular-nums text-xs">
                  {formatINR(row.igst2B)}
                </td>
                <td className="px-2 py-2 text-right align-top tabular-nums text-xs">
                  {formatINR(row.igstPR)}
                </td>
                <td className="px-2 py-2 text-right align-top tabular-nums text-xs">
                  {formatINR(row.cgst2B)}
                </td>
                <td className="px-2 py-2 text-right align-top tabular-nums text-xs">
                  {formatINR(row.cgstPR)}
                </td>
                <td className="px-2 py-2 text-right align-top tabular-nums text-xs">
                  {formatINR(row.sgst2B)}
                </td>
                <td className="px-2 py-2 text-right align-top tabular-nums text-xs">
                  {formatINR(row.sgstPR)}
                </td>
                <td className="px-2 py-2 align-top">{itcBadge(row.itcAvailable)}</td>
                <td className="px-2 py-2 align-top text-center text-xs">
                  {showTaxType ? (
                    <Tooltip>
                      <TooltipTrigger className="cursor-default border-0 bg-transparent p-0 font-semibold text-amber-800">
                        IGST↔CGST
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Total tax matches but tax type (IGST vs CGST/SGST) differs
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td
                  className={cn(
                    "px-2 py-2 text-right align-top tabular-nums font-semibold",
                    row.totalITCAtRisk > 0 ? "text-risk-critical" : "text-muted-foreground",
                  )}
                >
                  {formatINR(row.totalITCAtRisk)}
                </td>
                {showDeadlineColumn ? (
                  <td className={deadlineTdClass}>
                    <DeadlineCell row={row} />
                  </td>
                ) : null}
                <td className="max-w-[250px] px-2 py-2 align-top">
                  <div className="flex flex-col gap-1">
                    <Tooltip>
                      <TooltipTrigger className="block max-w-[250px] cursor-default truncate text-left text-xs text-brand-navy">
                        <span className="inline-flex flex-wrap items-start gap-1.5">
                          {row.status === "Suggested Match" && row.matchConfidence != null ? (
                            <span className="shrink-0 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-900">
                              {row.matchConfidence}% match
                            </span>
                          ) : null}
                          <span>{row.recommendedAction}</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm text-xs">
                        {row.recommendedAction}
                      </TooltipContent>
                    </Tooltip>
                    <CopyVendorMessageButton row={row} vendorMessage={vendorMessage} />
                  </div>
                </td>
                <td className="px-2 py-2 align-top">
                  <ActionBadge urgency={row.actionUrgency} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ViewModeToggle({
  viewMode,
  onViewMode,
}: {
  viewMode: "invoice" | "supplier"
  onViewMode: (m: "invoice" | "supplier") => void
}) {
  const pill = (active: boolean) =>
    cn(
      "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
      active
        ? "bg-[#2563EB] text-white"
        : "border border-border bg-white text-slate-600 hover:bg-slate-50",
    )

  return (
    <div
      className="grid w-full shrink-0 grid-cols-2 gap-1 md:flex md:w-auto md:items-center"
      role="group"
      aria-label="Results view"
    >
      <button
        type="button"
        className={cn(pill(viewMode === "invoice"), "min-h-11 justify-center md:min-h-0")}
        onClick={() => onViewMode("invoice")}
      >
        <List className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Invoice View
      </button>
      <button
        type="button"
        className={cn(pill(viewMode === "supplier"), "min-h-11 justify-center md:min-h-0")}
        onClick={() => onViewMode("supplier")}
      >
        <LayoutGrid className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Supplier View
      </button>
    </div>
  )
}

export function ReconciliationTable({
  rows,
  loading,
  filterBar,
  vendorMessage,
}: {
  rows: ReconciliationRow[]
  loading?: boolean
  filterBar?: ReconciliationTableFilterBarProps
  vendorMessage?: VendorMessageContext
}) {
  const [viewMode, setViewMode] = useState<"invoice" | "supplier">("invoice")

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex h-12 animate-pulse items-center gap-2 bg-surface-2/80 px-3"
            >
              <div className="h-4 flex-1 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const emptyBlock = (
    <div className="rounded-xl border border-border bg-white">
      <EmptyState />
    </div>
  )

  if (!filterBar) {
    if (!rows.length) return emptyBlock
    return <InvoiceTable rows={rows} vendorMessage={vendorMessage} />
  }

  const body =
    viewMode === "supplier" ? (
      <SupplierView rows={rows} activeFilter={filterBar.active} vendorMessage={vendorMessage} />
    ) : !rows.length ? (
      emptyBlock
    ) : (
      <InvoiceTable rows={rows} vendorMessage={vendorMessage} />
    )

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <FilterBar
            results={filterBar.results}
            active={filterBar.active}
            onChange={filterBar.onChange}
          />
        </div>
        <ViewModeToggle viewMode={viewMode} onViewMode={setViewMode} />
      </div>
      {body}
    </div>
  )
}
