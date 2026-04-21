export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-9 w-64 animate-pulse rounded-md bg-slate-200" />
          <div className="h-5 w-96 animate-pulse rounded-md bg-slate-200" />
        </div>
        <div className="h-11 w-52 animate-pulse rounded-lg bg-slate-200" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-xl border border-border bg-white shadow-sm"
          />
        ))}
      </div>
      <div className="h-11 w-full max-w-2xl animate-pulse rounded-lg bg-slate-200" />
      <div className="h-[280px] animate-pulse rounded-xl border border-border bg-white shadow-sm" />
      <div className="h-96 animate-pulse rounded-xl border border-border bg-white shadow-sm" />
    </div>
  )
}
