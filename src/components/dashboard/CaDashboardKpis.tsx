"use client"

import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type CaKpiCard = {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  iconClass: string
  valueClass?: string
  pulse?: boolean
}

export function CaDashboardKpis({ items }: { items: CaKpiCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {items.map((c) => (
        <div
          key={c.title}
          className={cn(
            "rounded-xl border border-border bg-white p-4 shadow-sm transition-shadow hover:shadow-md",
            c.pulse && "ring-2 ring-red-200",
          )}
        >
          <div className="flex items-start gap-3">
            <c.icon className={cn("h-8 w-8 shrink-0", c.iconClass)} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">{c.title}</p>
              <p className={cn("mt-1 truncate text-2xl font-semibold tabular-nums", c.valueClass ?? "text-brand-navy")}>
                {c.value}
              </p>
              {c.subtitle ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{c.subtitle}</p>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
