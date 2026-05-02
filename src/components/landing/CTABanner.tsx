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
    <section className="bg-[#0F1C2E] px-10 py-16 text-center font-dm">
      <div className="anim-fade-up visible">
        <h2 className="font-sora mb-3 text-[30px] font-extrabold tracking-[-0.6px] text-white">
          Stop leaving ITC on the table.
        </h2>
        <p className="mx-auto mb-7 max-w-[480px] text-[14px] leading-relaxed text-slate-400">
          GST Shield finds mismatches, blocked credits, and recovery opportunities your team is missing
          — every single month.
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={go}
          className="inline-flex items-center justify-center gap-2 rounded-[9px] border-none bg-[#1447E6] px-9 py-3.5 text-[14px] font-bold text-white transition-all duration-200 hover:-translate-y-px hover:bg-[#0F3DD4] hover:shadow-[0_6px_20px_rgba(20,71,230,.35)] disabled:pointer-events-none disabled:opacity-70"
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
