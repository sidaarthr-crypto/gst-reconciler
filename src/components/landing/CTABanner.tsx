"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function CTABanner() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  function go() {
    if (busy) return
    setBusy(true)
    window.setTimeout(() => {
      router.push("/reconcile")
    }, 0)
  }

  return (
    <section className="bg-brand-navy py-14 text-white">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
        <h2 className="text-2xl font-bold sm:text-3xl">
          Ready to stop reconciling manually?
        </h2>
        <p className="mt-3 text-sm text-white/80 sm:text-base">
          Join CAs across India saving hours every month.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={go}
          className={cn(
            buttonVariants({ size: "lg" }),
            "mt-8 min-w-[260px] bg-white font-semibold text-brand-navy hover:bg-surface-2",
            "inline-flex items-center justify-center gap-2 disabled:pointer-events-none disabled:opacity-70",
          )}
        >
          {busy ? (
            <>
              <span
                className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden
              />
              Opening...
            </>
          ) : (
            <>
              Start Reconciling Free <span aria-hidden>→</span>
            </>
          )}
        </button>
      </div>
    </section>
  )
}
