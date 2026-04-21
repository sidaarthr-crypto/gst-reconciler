"use client"

import { Building2 } from "lucide-react"

import { formatINR } from "@/lib/utils"
export type DashboardSupplierRow = {
  supplierGstin: string
  supplierName: string
  invoiceCount: number
  itcSafe: number
  itcAtRisk: number
  lastInvoiceDate: string | null
}

function parseDdMmYyyy(s: string | null): Date | null {
  if (!s) return null
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s.trim())
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
    return Number.isNaN(d.getTime()) ? null : d
  }
  const iso = Date.parse(s)
  return Number.isNaN(iso) ? null : new Date(iso)
}

function formatInvoiceDate(s: string | null): string {
  if (!s) return "—"
  const d = parseDdMmYyyy(s)
  if (!d) return s
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
}

export function SupplierTable({ rows }: { rows: DashboardSupplierRow[] }) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-border bg-white p-8 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">ITC summary by supplier</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Top suppliers by ITC claimed across all reconciliations
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/60" aria-hidden />
          <p className="font-medium text-brand-navy">No supplier data yet</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Complete a reconciliation to see ITC rolled up by supplier.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-brand-navy">ITC summary by supplier</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Top suppliers by ITC claimed across all reconciliations
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="border-b border-border bg-surface-2 text-left text-xs font-medium text-brand-navy">
            <tr>
              <th className="px-3 py-2">Supplier name</th>
              <th className="px-3 py-2">Supplier GSTIN</th>
              <th className="px-3 py-2 text-right">Total invoices</th>
              <th className="px-3 py-2 text-right">ITC safe</th>
              <th className="px-3 py-2 text-right">ITC at risk</th>
              <th className="px-3 py-2">Last invoice date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.supplierGstin}
                className="cursor-pointer border-t border-border transition-colors hover:bg-surface-2"
              >
                <td className="px-3 py-2 font-medium text-brand-navy">{r.supplierName || "—"}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.supplierGstin}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.invoiceCount}</td>
                <td className="px-3 py-2 text-right font-medium text-emerald-700 tabular-nums">
                  {formatINR(r.itcSafe)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-medium tabular-nums ${r.itcAtRisk > 0 ? "text-red-700" : "text-muted-foreground"}`}
                >
                  {formatINR(r.itcAtRisk)}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{formatInvoiceDate(r.lastInvoiceDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length >= 10 ? (
        <p className="mt-3 text-right text-xs font-medium text-brand-blue">View all →</p>
      ) : null}
    </div>
  )
}
