import { Clock } from "lucide-react"

export function TrustBar() {
  return (
    <section className="border-y border-border bg-surface-3 py-8">
      <div className="mx-auto grid max-w-4xl grid-cols-2 items-center justify-items-center gap-4 px-4 md:grid-cols-3 md:gap-10 md:px-6">
        <div className="flex w-full justify-center">
          <span className="relative inline-flex items-center gap-2 rounded-full bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white">
            <span
              className="pointer-events-none absolute -inset-0.5 rounded-full ring-2 ring-[#2563EB]/40 animate-pulse"
              aria-hidden
            />
            <Clock className="relative h-4 w-4 shrink-0" aria-hidden />
            <span className="relative">30+ hrs saved/month</span>
          </span>
        </div>
        <p className="flex w-full justify-center text-center text-xs font-medium text-brand-slate">
          ₹0 to start
        </p>
        <p className="flex w-full justify-center text-center text-xs font-medium text-brand-slate">
          B2B ready
        </p>
      </div>
    </section>
  )
}
