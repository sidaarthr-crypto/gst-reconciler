import { FileSearch } from "lucide-react"

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
      <FileSearch className="h-10 w-10 opacity-40" aria-hidden />
      <p className="text-sm font-medium text-brand-slate">
        No invoices match this filter
      </p>
      <p className="max-w-sm text-xs">
        Try selecting &quot;All&quot; or another status to see more rows from this
        reconciliation.
      </p>
    </div>
  )
}
