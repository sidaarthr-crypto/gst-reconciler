"use client"

import { useEffect, useState } from "react"
import { FileSearch, LayoutGrid, List } from "lucide-react"

import { EmptyState } from "@/components/reconcile/EmptyState"
import { FilterBar } from "@/components/reconcile/FilterBar"
import { InvoiceDetailModal } from "@/components/reconcile/InvoiceDetailModal"
import { RiskBadge } from "@/components/reconcile/RiskBadge"
import { StatusBadge } from "@/components/reconcile/StatusBadge"
import { SupplierView } from "@/components/reconcile/SupplierView"
import { cn, formatINR } from "@/lib/utils"
import type {
  ActionUrgency,
  ReconciliationFilterId,
  ReconciliationRow,
  VendorMessageContext,
} from "@/lib/types"

export type { VendorMessageContext }

export type ReconciliationTableFilterBarProps = {
  results: ReconciliationRow[]
  activeFilters: ReconciliationFilterId[]
  activeUrgencies: ActionUrgency[]
  onChange: (next: ReconciliationFilterId[]) => void
  onUrgencyChange: (next: ActionUrgency[]) => void
}

function UrgencyBadge({ urgency }: { urgency: ReconciliationRow["actionUrgency"] }) {
  if (!urgency || urgency === "None") return null
  if (urgency === "Immediate") {
    return (
      <span className="inline-flex w-fit rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
        Immediate
      </span>
    )
  }
  if (urgency === "Before Filing") {
    return (
      <span className="inline-flex w-fit rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
        Before Filing
      </span>
    )
  }
  return (
    <span className="inline-flex w-fit rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
      Monitor
    </span>
  )
}

function InvoiceTable({
  rows,
  vendorMessage,
}: {
  rows: ReconciliationRow[]
  vendorMessage?: VendorMessageContext
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const openModal = (index: number) => {
    setSelectedIndex(index)
    setModalOpen(true)
  }

  const navigate = (direction: "prev" | "next") => {
    if (selectedIndex === null) return
    const next = direction === "next" ? selectedIndex + 1 : selectedIndex - 1
    if (next >= 0 && next < rows.length) setSelectedIndex(next)
  }

  useEffect(() => {
    if (!modalOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") navigate("next")
      if (e.key === "ArrowLeft") navigate("prev")
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [modalOpen, selectedIndex, rows.length])

  return (
    <div className="relative w-full overflow-x-auto overflow-y-auto rounded-lg border border-slate-200 bg-white max-h-[400px] lg:max-h-[600px]">
      <table className="w-full table-fixed divide-y divide-slate-200 text-sm">
        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase [box-shadow:0_1px_3px_rgba(0,0,0,0.08)]">
          <tr>
            <th className="w-20 whitespace-nowrap px-3 py-3">Risk</th>
            <th className="w-[140px] whitespace-nowrap px-3 py-3">Status</th>
            <th className="w-[110px] whitespace-nowrap px-3 py-3">Urgency</th>
            <th className="w-[170px] whitespace-nowrap px-3 py-3">Supplier</th>
            <th className="w-[130px] whitespace-nowrap px-3 py-3">Invoice No</th>
            <th className="w-[90px] whitespace-nowrap px-3 py-3">Invoice Date</th>
            <th className="w-[110px] whitespace-nowrap px-3 py-3 text-right">ITC At Risk</th>
            <th className="w-20 whitespace-nowrap px-3 py-3">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-12 text-center">
                <FileSearch className="mx-auto mb-2 text-slate-300" size={32} />
                <p className="text-sm text-slate-400">No invoices match this filter</p>
              </td>
            </tr>
          ) : null}
          {rows.map((row, idx) => {
            return (
              <tr
                key={`${row.matchKey}-${row.invoiceNumber}-${idx}`}
                className={cn(
                  "h-14 border-b border-slate-100 transition-colors hover:bg-slate-50",
                  idx % 2 === 1 && "bg-slate-50/30",
                )}
              >
                <td className="w-20 px-3 py-3 align-middle text-xs">
                  <RiskBadge row={row} />
                </td>
                <td className="w-[140px] px-3 py-3 align-middle text-xs">
                  <StatusBadge status={row.status} />
                </td>
                <td className="w-[110px] px-3 py-3 align-middle text-xs">
                  <UrgencyBadge urgency={row.actionUrgency} />
                </td>
                <td
                  className="w-[170px] px-3 py-3 align-middle"
                  title={row.supplierName}
                >
                  <p className="truncate text-sm font-medium text-slate-800">{row.supplierName}</p>
                  <p className="truncate font-mono text-xs text-slate-400">{row.supplierGSTIN}</p>
                </td>
                <td className="w-[130px] px-3 py-3 align-middle font-mono text-xs truncate" title={row.invoiceNumber}>
                  {row.invoiceNumber}
                </td>
                <td className="w-[90px] px-3 py-3 align-middle text-xs">{row.invoiceDate}</td>
                <td
                  className={cn(
                    "w-[110px] px-3 py-3 align-middle text-right font-mono text-xs tabular-nums",
                    row.totalITCAtRisk > 0 ? "font-semibold text-red-600" : "text-slate-400",
                  )}
                >
                  {row.totalITCAtRisk > 0 ? formatINR(row.totalITCAtRisk) : "—"}
                </td>
                <td className="w-20 px-3 py-3 align-middle text-xs">
                  <button
                    type="button"
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    onClick={() => openModal(idx)}
                  >
                    Details →
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <InvoiceDetailModal
        row={selectedIndex !== null ? rows[selectedIndex] : null}
        allRows={rows}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onNavigate={navigate}
        currentIndex={selectedIndex ?? 0}
        vendorMessage={vendorMessage}
      />
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
      <SupplierView
        rows={rows}
        activeFilters={filterBar.activeFilters}
        vendorMessage={vendorMessage}
      />
    ) : (
      <InvoiceTable rows={rows} vendorMessage={vendorMessage} />
    )

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1">
          <FilterBar
            results={filterBar.results}
            activeFilters={filterBar.activeFilters}
            activeUrgencies={filterBar.activeUrgencies}
            onChange={filterBar.onChange}
            onUrgencyChange={filterBar.onUrgencyChange}
          />
        </div>
        <ViewModeToggle viewMode={viewMode} onViewMode={setViewMode} />
      </div>
      {body}
    </div>
  )
}
