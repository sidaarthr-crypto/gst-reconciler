"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

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
    <section className="overflow-x-hidden bg-[#0F1C2E] px-4 py-12 text-center font-dm sm:px-6 md:py-16 lg:px-10">
      <div className="anim-fade-up visible">
        <h2 className="font-sora mb-3 text-2xl font-extrabold tracking-[-0.6px] text-white md:text-3xl lg:text-[30px]">
          Stop leaving ITC on the table.
        </h2>
        <p className="mx-auto mb-7 max-w-[480px] text-sm leading-relaxed text-slate-400 sm:text-[14px]">
          GSTRecon finds mismatches, blocked credits, and recovery opportunities your team is missing
          — every single month.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={go}
          className="inline-flex min-h-11 w-full max-w-lg items-center justify-center gap-2 rounded-[9px] border-none bg-[#1447E6] px-6 py-3.5 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-px hover:bg-[#0F3DD4] hover:shadow-[0_6px_20px_rgba(20,71,230,.35)] disabled:pointer-events-none disabled:opacity-70 sm:w-auto sm:px-9 sm:text-[14px]"
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
              Start Free — First 15 Reconciliations Free <span aria-hidden>→</span>
            </>
          )}
        </button>
      </div>
    </section>
  )
}
