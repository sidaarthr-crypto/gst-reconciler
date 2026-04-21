export default function RequestDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-10">
      <div className="h-6 w-64 animate-pulse rounded bg-slate-200" />
      <div className="h-10 w-full max-w-md animate-pulse rounded bg-slate-200" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl border border-border bg-white" />
        ))}
      </div>
      <div className="h-10 w-full animate-pulse rounded-lg bg-slate-200" />
      <div className="h-[420px] animate-pulse rounded-xl border border-border bg-white" />
    </div>
  )
}
