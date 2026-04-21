"use client"

import { useMemo } from "react"
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from "chart.js"
import { Bar } from "react-chartjs-2"
import { BarChart2 } from "lucide-react"

import { formatINR, getMonthName } from "@/lib/utils"
import type { DashboardMonthlyRow } from "@/lib/dashboard-types"

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

function formatAxisInr(n: number): string {
  if (n >= 1_000_000) return `₹${(n / 1_000_000).toFixed(1)}L`
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`
  return `₹${Math.round(n).toLocaleString("en-IN")}`
}

export function MonthlyChart({
  rows,
  title = "Monthly ITC summary",
  subtitle = "ITC safe to claim vs ITC at risk by reconciliation period",
  highlightMonthYear = null,
  showSingleRunNote = false,
}: {
  rows: DashboardMonthlyRow[]
  title?: string
  subtitle?: string
  highlightMonthYear?: { month: number; year: number } | null
  showSingleRunNote?: boolean
}) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month)),
    [rows],
  )

  const data = useMemo(() => {
    const labels = sorted.map((r) => `${getMonthName(r.month).slice(0, 3)} ${r.year}`)
    const hl = highlightMonthYear
    const safeBg = sorted.map((r) => {
      if (!hl) return "#16A34A"
      const on = r.month === hl.month && r.year === hl.year
      return on ? "#16A34A" : "rgba(22, 163, 74, 0.28)"
    })
    const riskBg = sorted.map((r) => {
      if (!hl) return "#DC2626"
      const on = r.month === hl.month && r.year === hl.year
      return on ? "#DC2626" : "rgba(220, 38, 38, 0.28)"
    })
    return {
      labels,
      datasets: [
        {
          label: "ITC Safe to Claim",
          data: sorted.map((r) => r.itcSafe),
          backgroundColor: safeBg,
          borderRadius: 4,
        },
        {
          label: "ITC At Risk",
          data: sorted.map((r) => r.itcAtRisk),
          backgroundColor: riskBg,
          borderRadius: 4,
        },
      ],
    }
  }, [sorted, highlightMonthYear])

  const options: ChartOptions<"bar"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(items) {
              const i = items[0]?.dataIndex ?? 0
              const r = sorted[i]
              if (!r) return ""
              return `${getMonthName(r.month)} ${r.year}`
            },
            afterBody(items) {
              const i = items[0]?.dataIndex ?? 0
              const r = sorted[i]
              if (!r) return ""
              const lines = [`Reconciliations: ${r.sessionCount}`]
              if (r.totalInvoices > 0) {
                lines.push(`Invoices processed: ${r.totalInvoices.toLocaleString("en-IN")}`)
              }
              return lines.join("\n")
            },
            label(ctx) {
              const v = ctx.parsed.y ?? 0
              const label = ctx.dataset.label ?? ""
              return `${label}: ${formatINR(v)}`
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#475569", font: { size: 11 } },
        },
        y: {
          grid: { color: "#E2E8F0" },
          ticks: {
            color: "#64748B",
            callback: (v) => formatAxisInr(Number(v)),
          },
        },
      },
    }),
    [sorted],
  )

  if (!sorted.length) {
    return (
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        <div
          className="mt-6 flex h-[280px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface-2 text-center"
          style={{ minHeight: 280 }}
        >
          <BarChart2 className="h-12 w-12 text-muted-foreground/60" aria-hidden />
          <p className="font-medium text-brand-navy">No reconciliation data yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Complete your first reconciliation to see monthly trends.
          </p>
        </div>
      </div>
    )
  }

  const singleRun =
    showSingleRunNote && sorted.length === 1 && (sorted[0]?.sessionCount ?? 0) === 1

  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-brand-navy">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      {singleRun ? (
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          Only 1 reconciliation on record.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-6 text-xs font-medium">
        <span className="inline-flex items-center gap-2 text-brand-navy">
          <span className="inline-block h-3 w-3 rounded-sm bg-[#16A34A]" aria-hidden />
          ITC safe to claim
        </span>
        <span className="inline-flex items-center gap-2 text-brand-navy">
          <span className="inline-block h-3 w-3 rounded-sm bg-[#DC2626]" aria-hidden />
          ITC at risk
        </span>
      </div>
      <div className="mt-4 h-[280px] w-full">
        <Bar data={data} options={options} />
      </div>
    </div>
  )
}
