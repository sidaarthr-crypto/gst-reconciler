"use client"

import { Search } from "lucide-react"

export function SearchBar({
  value,
  onChange,
  placeholder = "Search by Request ID, period, or filename...",
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-brand-navy shadow-sm outline-none ring-brand-blue/30 transition focus:ring-2"
        aria-label="Search reconciliations"
      />
    </div>
  )
}
