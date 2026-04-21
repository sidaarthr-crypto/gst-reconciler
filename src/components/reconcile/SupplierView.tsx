"use client"

import { useCallback, useMemo, useState } from "react"
import { ChevronDown, Clipboard } from "lucide-react"

import { ActionBadge } from "@/components/reconcile/ActionBadge"
import { RiskBadge } from "@/components/reconcile/RiskBadge"
import { StatusBadge } from "@/components/reconcile/StatusBadge"
import { EmptyState } from "@/components/reconcile/EmptyState"
import { cn, formatINR, generateVendorMessage } from "@/lib/utils"
import type {
  ITCRiskLevel,
  ReconciliationFilterId,
  ReconciliationRow,
  VendorMessageContext,
} from "@/lib/types"

/** GST state / UT codes (first 2 digits of GSTIN) → display name (GSTN list + common extras). */
export const GST_STATE_CODE_TO_NAME: Record<string, string> = {
  "01": "J&K",
  "02": "HP",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Dadra & Nagar Haveli & Daman & Diu",
  "26": "Dadra & Nagar Haveli & Daman & Diu",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (old)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman & Nicobar",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
}

const RISK_RANK: Record<ITCRiskLevel, number> = {
  Critical: 0,
  High: 1,
  Medium: 2,
  Safe: 3,
}

function stateFromGstin(gstin: string): { stateCode: string; stateName: string } {
  const code = (gstin ?? "").trim().slice(0, 2)
  if (!code || code.length < 2) return { stateCode: "—", stateName: "Unknown" }
  const name = GST_STATE_CODE_TO_NAME[code] ?? "Unknown"
  return { stateCode: code, stateName: name }
}

function maxRisk(a: ITCRiskLevel, b: ITCRiskLevel): ITCRiskLevel {
  return RISK_RANK[a] <= RISK_RANK[b] ? a : b
}

export interface SupplierGroup {
  supplierGSTIN: string
  supplierName: string
  stateCode: string
  stateName: string
  totalInvoices: number
  matchedCount: number
  mismatchCount: number
  missingCount: number
  criticalCount: number
  itcSafe: number
  itcAtRisk: number
  worstRisk: ITCRiskLevel
  invoices: ReconciliationRow[]
  /** UI-only; not set by `groupBySupplier`. */
  isExpanded?: boolean
}

export function groupBySupplier(rows: ReconciliationRow[]): SupplierGroup[] {
  const by = new Map<string, ReconciliationRow[]>()
  for (const r of rows) {
    const k = r.supplierGSTIN.trim()
    if (!by.has(k)) by.set(k, [])
    by.get(k)!.push(r)
  }

  const groups: SupplierGroup[] = []
  for (const [supplierGSTIN, invoices] of by) {
    let worstRisk: ITCRiskLevel = "Safe"
    let matchedCount = 0
    let mismatchCount = 0
    let missingCount = 0
    let criticalCount = 0
    let itcSafe = 0
    let itcAtRisk = 0
    const supplierName =
      invoices.find((x) => x.supplierName?.trim())?.supplierName?.trim() ?? supplierGSTIN

    for (const r of invoices) {
      worstRisk = maxRisk(worstRisk, r.itcRisk)
      if (r.status === "Matched") matchedCount += 1
      if (r.status === "Value Mismatch" || r.status === "Tax Type Mismatch") mismatchCount += 1
      if (r.status === "In PR Only" || r.status === "In 2B Only") missingCount += 1
      if (r.itcRisk === "Critical") criticalCount += 1
      if (r.status === "Matched") {
        itcSafe += (r.igst2B ?? 0) + (r.cgst2B ?? 0) + (r.sgst2B ?? 0)
      }
      itcAtRisk += r.totalITCAtRisk ?? 0
    }

    const { stateCode, stateName } = stateFromGstin(supplierGSTIN)
    groups.push({
      supplierGSTIN,
      supplierName,
      stateCode,
      stateName,
      totalInvoices: invoices.length,
      matchedCount,
      mismatchCount,
      missingCount,
      criticalCount,
      itcSafe,
      itcAtRisk,
      worstRisk,
      invoices,
    })
  }

  groups.sort((a, b) => {
    const d = RISK_RANK[a.worstRisk] - RISK_RANK[b.worstRisk]
    if (d !== 0) return d
    return b.itcAtRisk - a.itcAtRisk
  })

  return groups
}

function groupFullyClean(g: SupplierGroup): boolean {
  return g.invoices.every((r) => r.status === "Matched" && r.itcRisk === "Safe")
}

function syntheticRowForRisk(level: ITCRiskLevel): ReconciliationRow {
  return {
    supplierGSTIN: "",
    supplierName: "",
    invoiceNumber: "",
    invoiceDate: "",
    placeOfSupply: "",
    matchKey: "",
    status: "Matched",
    itcRisk: level,
    itcAvailable: null,
    reverseCharge: null,
    taxable2B: null,
    igst2B: null,
    cgst2B: null,
    sgst2B: null,
    taxablePR: null,
    igstPR: null,
    cgstPR: null,
    sgstPR: null,
    taxableDiff: null,
    igstDiff: null,
    cgstDiff: null,
    sgstDiff: null,
    totalITCAtRisk: 0,
    recommendedAction: "",
    actionUrgency: "None",
    riskSortOrder: 0,
  }
}

function accentBorder(risk: ITCRiskLevel): string {
  switch (risk) {
    case "Critical":
      return "border-l-[#DC2626]"
    case "High":
      return "border-l-[#EA580C]"
    case "Medium":
      return "border-l-[#D97706]"
    default:
      return "border-l-[#16A34A]"
  }
}

const MINI_INITIAL = 5

function MiniInvoiceTable({
  rows,
  showAll,
  onShowAll,
}: {
  rows: ReconciliationRow[]
  showAll: boolean
  onShowAll: () => void
}) {
  const visible = showAll ? rows : rows.slice(0, MINI_INITIAL)
  return (
    <div className="scroll-table-hint overflow-x-auto [-webkit-overflow-scrolling:touch]">
      <table className="w-full min-w-[360px] border-collapse text-xs">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
            <th className="px-2 py-2">Risk</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2">Invoice No</th>
            <th className="hidden px-2 py-2 md:table-cell">Date</th>
            <th className="hidden px-2 py-2 text-right md:table-cell">Taxable (2B)</th>
            <th className="hidden px-2 py-2 text-right md:table-cell">Taxable (PR)</th>
            <th className="px-2 py-2 text-right">ITC At Risk</th>
            <th className="hidden px-2 py-2 md:table-cell">Urgency</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row, idx) => (
            <tr
              key={`${row.matchKey}-${row.invoiceNumber}-${idx}`}
              className="border-t border-border transition-colors hover:bg-[#F8FAFC]"
            >
              <td className="px-2 py-1.5 align-top">
                <div className="origin-left scale-[0.92]">
                  <RiskBadge row={row} />
                </div>
              </td>
              <td className="px-2 py-1.5 align-top">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-2 py-1.5 font-mono align-top">{row.invoiceNumber}</td>
              <td className="hidden px-2 py-1.5 align-top md:table-cell">{row.invoiceDate}</td>
              <td className="hidden px-2 py-1.5 text-right align-top tabular-nums md:table-cell">
                {formatINR(row.taxable2B)}
              </td>
              <td className="hidden px-2 py-1.5 text-right align-top tabular-nums md:table-cell">
                {formatINR(row.taxablePR)}
              </td>
              <td
                className={cn(
                  "px-2 py-1.5 text-right align-top tabular-nums font-semibold",
                  row.totalITCAtRisk > 0 ? "text-risk-critical" : "text-muted-foreground",
                )}
              >
                {formatINR(row.totalITCAtRisk)}
              </td>
              <td className="hidden px-2 py-1.5 align-top md:table-cell">
                <ActionBadge urgency={row.actionUrgency} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > MINI_INITIAL && !showAll ? (
        <p className="mt-2 px-2 text-[11px] text-muted-foreground">
          Showing {MINI_INITIAL} of {rows.length} invoices ·{" "}
          <button
            type="button"
            className="font-medium text-brand-blue hover:underline"
            onClick={(e) => {
              e.stopPropagation()
              onShowAll()
            }}
          >
            Show all {rows.length} →
          </button>
        </p>
      ) : null}
    </div>
  )
}

export function SupplierView({
  rows,
  activeFilter: _activeFilter,
  vendorMessage,
}: {
  rows: ReconciliationRow[]
  /** Parent passes filtered rows; kept for API parity with filter-driven views. */
  activeFilter: ReconciliationFilterId
  vendorMessage?: VendorMessageContext
}) {
  void _activeFilter
  const groups = useMemo(() => groupBySupplier(rows), [rows])
  const [expandedGSTINs, setExpandedGSTINs] = useState<Set<string>>(() => new Set())
  const [showAllByGstin, setShowAllByGstin] = useState<Set<string>>(() => new Set())
  const [copyAllFlash, setCopyAllFlash] = useState<{ gstin: string; n: number } | null>(null)

  const totalAtRisk = useMemo(() => groups.reduce((s, g) => s + g.itcAtRisk, 0), [groups])
  const haveIssuesCount = useMemo(() => groups.filter((g) => !groupFullyClean(g)).length, [groups])
  const allCleanCount = useMemo(() => groups.filter((g) => groupFullyClean(g)).length, [groups])

  const expandAll = useCallback(() => {
    setExpandedGSTINs(new Set(groups.map((g) => g.supplierGSTIN)))
  }, [groups])

  const collapseAll = useCallback(() => {
    setExpandedGSTINs(new Set())
    setShowAllByGstin(new Set())
  }, [])

  const toggle = useCallback((gstin: string) => {
    setExpandedGSTINs((prev) => {
      const next = new Set(prev)
      if (next.has(gstin)) next.delete(gstin)
      else next.add(gstin)
      return next
    })
  }, [])

  const copyAllMessages = useCallback(
    async (g: SupplierGroup) => {
      if (!vendorMessage) return
      const period = vendorMessage.period.trim() || "the relevant return period"
      const parts = g.invoices
        .filter((r) => r.status !== "Matched" && r.status !== "QRMP Delay")
        .map((r) => generateVendorMessage(r, period, vendorMessage.caName))
        .filter((s) => s.trim().length > 0)
      if (!parts.length) return
      try {
        await navigator.clipboard.writeText(parts.join("\n\n---\n\n"))
        setCopyAllFlash({ gstin: g.supplierGSTIN, n: parts.length })
        window.setTimeout(() => {
          setCopyAllFlash((cur) => (cur?.gstin === g.supplierGSTIN ? null : cur))
        }, 2000)
      } catch {
        // Clipboard unavailable
      }
    },
    [vendorMessage],
  )

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-border bg-white">
        <EmptyState />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-white">
      <div className="mb-4 flex flex-col gap-2 border-b border-border px-4 pb-3 pt-4 text-[13px] text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="flex flex-wrap items-center gap-x-1 gap-y-1">
          <span className="font-medium text-brand-navy">{groups.length}</span>
          <span>suppliers</span>
          <span aria-hidden className="text-border">
            •
          </span>
          <span>
            <span className="font-medium text-brand-navy">{haveIssuesCount}</span> have issues
          </span>
          <span aria-hidden className="text-border">
            •
          </span>
          <span>
            <span className="font-medium text-brand-navy">{allCleanCount}</span> all clean
          </span>
          <span aria-hidden className="text-border">
            •
          </span>
          <span>
            Total At Risk:{" "}
            <span className="font-semibold text-brand-navy">{formatINR(totalAtRisk)}</span>
          </span>
        </p>
        <p className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            className="font-medium text-brand-blue hover:underline"
            onClick={expandAll}
          >
            Expand All
          </button>
          <span className="text-border">|</span>
          <button
            type="button"
            className="font-medium text-brand-blue hover:underline"
            onClick={collapseAll}
          >
            Collapse All
          </button>
        </p>
      </div>

      <div className="p-4">
        {groups.map((g) => {
          const expanded = expandedGSTINs.has(g.supplierGSTIN)
          const showAllInv = showAllByGstin.has(g.supplierGSTIN)
          const supplierNeedsFollowUp = g.invoices.some(
            (r) => r.status !== "Matched" && r.status !== "QRMP Delay",
          )
          const showingCopiedAll = copyAllFlash?.gstin === g.supplierGSTIN
          return (
            <div key={g.supplierGSTIN} className="mb-3 last:mb-0">
              <div
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                aria-label={`${g.supplierName}, ${expanded ? "collapse" : "expand"} supplier details`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    toggle(g.supplierGSTIN)
                  }
                }}
                onClick={() => toggle(g.supplierGSTIN)}
                className={cn(
                  "w-full cursor-pointer border border-[#E2E8F0] bg-white px-5 py-4 text-left shadow-sm transition-shadow hover:shadow-md",
                  "border-l-4",
                  accentBorder(g.worstRisk),
                  expanded ? "rounded-t-xl rounded-b-none border-b-0" : "rounded-xl",
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <RiskBadge row={syntheticRowForRisk(g.worstRisk)} />
                      <span className="text-[15px] font-semibold text-brand-navy">{g.supplierName}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{g.supplierGSTIN}</span>
                      <span> • </span>
                      <span>{g.stateName}</span>
                    </p>
                  </div>

                  <div className="grid w-full grid-cols-2 gap-x-6 gap-y-3 lg:flex lg:w-auto lg:flex-wrap lg:items-end lg:justify-center">
                    <div>
                      <p className="text-lg font-bold text-brand-navy">{g.totalInvoices}</p>
                      <p className="text-xs text-muted-foreground">invoices</p>
                    </div>
                    {g.matchedCount > 0 ? (
                      <div>
                        <p className="text-lg font-bold text-[#16A34A]">{g.matchedCount}</p>
                        <p className="text-xs text-muted-foreground">matched</p>
                      </div>
                    ) : null}
                    {g.mismatchCount > 0 ? (
                      <div>
                        <p className="text-lg font-bold text-[#D97706]">{g.mismatchCount}</p>
                        <p className="text-xs text-muted-foreground">mismatch</p>
                      </div>
                    ) : null}
                    {g.missingCount > 0 ? (
                      <div>
                        <p className="text-lg font-bold text-[#EA580C]">{g.missingCount}</p>
                        <p className="text-xs text-muted-foreground">missing</p>
                      </div>
                    ) : null}
                    {g.criticalCount > 0 ? (
                      <div>
                        <p className="text-lg font-bold text-[#DC2626]">{g.criticalCount}</p>
                        <p className="text-xs text-muted-foreground">critical</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex w-full max-lg:order-last max-lg:flex-col max-lg:gap-3 max-lg:border-t max-lg:border-slate-100 max-lg:pt-3 lg:w-auto lg:flex-row lg:flex-wrap lg:items-end lg:justify-end lg:gap-4 lg:border-t-0 lg:pt-0">
                    <div className="flex w-full justify-between gap-6 lg:w-auto lg:justify-end">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#16A34A]">{formatINR(g.itcSafe)}</p>
                        <p className="text-xs text-muted-foreground">ITC safe</p>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            g.itcAtRisk > 0 ? "text-[#DC2626]" : "text-muted-foreground",
                          )}
                        >
                          {formatINR(g.itcAtRisk)}
                        </p>
                        <p className="text-xs text-muted-foreground">at risk</p>
                      </div>
                    </div>
                    <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-center lg:gap-2">
                      {supplierNeedsFollowUp && vendorMessage ? (
                        <button
                          type="button"
                          className={cn(
                            "inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-md border border-border bg-white px-2.5 py-2 text-xs font-medium text-brand-navy shadow-sm transition-colors hover:bg-slate-50 lg:w-auto lg:min-h-0 lg:py-1.5",
                            showingCopiedAll && "border-emerald-200 text-emerald-700",
                          )}
                          onClick={(e) => {
                            e.stopPropagation()
                            void copyAllMessages(g)
                          }}
                        >
                          {showingCopiedAll ? (
                            <>✓ Copied {copyAllFlash?.n} messages!</>
                          ) : (
                            <>
                              <Clipboard className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              Copy All Messages
                            </>
                          )}
                        </button>
                      ) : null}
                      <div className="flex h-11 w-full items-center justify-center text-brand-navy lg:h-9 lg:w-9">
                        <ChevronDown
                          className={cn(
                            "pointer-events-none h-[18px] w-[18px] shrink-0 transition-transform duration-200 ease-in-out",
                            expanded && "rotate-180",
                          )}
                          aria-hidden
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {expanded ? (
                <div
                  className={cn(
                    "rounded-b-xl border border-t-0 border-[#E2E8F0] bg-white px-4 pb-4 pt-0 sm:px-5",
                    "border-l-4",
                    accentBorder(g.worstRisk),
                  )}
                >
                  <MiniInvoiceTable
                    rows={g.invoices}
                    showAll={showAllInv}
                    onShowAll={() =>
                      setShowAllByGstin((prev) => new Set(prev).add(g.supplierGSTIN))
                    }
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
