"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const HERO_PHRASES = ["in 60 seconds.", "in one click.", "without errors."]

export function Hero() {
  const router = useRouter()
  const [i, setI] = useState(0)
  const [text, setText] = useState("")
  const [navBusy, setNavBusy] = useState<"primary" | "secondary" | null>(null)

  useEffect(() => {
    const phrase = HERO_PHRASES[i % HERO_PHRASES.length]
    let j = 0
    const id = window.setInterval(() => {
      j += 1
      setText(phrase.slice(0, j))
      if (j >= phrase.length) {
        window.clearInterval(id)
      }
    }, 40)
    return () => window.clearInterval(id)
  }, [i])

  useEffect(() => {
    const t = window.setInterval(() => {
      setI((v) => v + 1)
    }, 2000)
    return () => window.clearInterval(t)
  }, [])

  function goReconcile(which: "primary" | "secondary") {
    if (navBusy) return
    setNavBusy(which)
    window.setTimeout(() => {
      router.push("/reconcile")
    }, 0)
  }

  return (
    <section className="relative overflow-x-hidden overflow-y-visible dot-grid-bg">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-16 md:px-6 lg:flex lg:items-center lg:gap-12 lg:pt-20">
        <div className="max-w-xl flex-1">
          <h1 className="text-3xl font-bold leading-tight text-brand-navy md:text-4xl lg:text-6xl">
            <span className="block">
              Reconcile{" "}
              <span className="whitespace-nowrap">GSTR-2B</span>
            </span>
            <span className="mt-1 block min-h-[1.2em] overflow-visible text-brand-blue">
              <span className="inline-block min-w-[240px] whitespace-nowrap">
                {text}
                <span className="animate-pulse">|</span>
              </span>
            </span>
          </h1>
          <p className="mt-6 text-base text-slate-500 md:text-lg lg:text-xl">
            Upload your GSTR-2B and Purchase Register. Get ITC risk scores, exact mismatch
            details, and plain English actions for every invoice. Free. No login required.
          </p>
          <div className="mt-8 flex w-full flex-col gap-3 md:w-auto md:flex-row md:flex-wrap">
            <button
              type="button"
              disabled={navBusy !== null}
              onClick={() => goReconcile("primary")}
              className={cn(
                buttonVariants({ size: "lg" }),
                "min-h-11 w-full bg-brand-blue px-6 text-base font-semibold text-white hover:bg-brand-blue/90 md:w-auto md:min-w-[220px]",
                "inline-flex items-center justify-center gap-2 disabled:pointer-events-none disabled:opacity-70",
              )}
            >
              {navBusy === "primary" ? (
                <>
                  <span
                    className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                    aria-hidden
                  />
                  Opening...
                </>
              ) : (
                <>
                  Start Reconciling <span aria-hidden>→</span>
                </>
              )}
            </button>
            <button
              type="button"
              disabled={navBusy !== null}
              onClick={() => goReconcile("secondary")}
              className={cn(
                buttonVariants({ size: "lg", variant: "outline" }),
                "min-h-11 w-full border-brand-navy text-brand-navy md:w-auto md:min-w-[200px]",
                "inline-flex items-center justify-center gap-2 disabled:pointer-events-none disabled:opacity-70",
              )}
            >
              {navBusy === "secondary" ? (
                <>
                  <span
                    className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                    aria-hidden
                  />
                  Opening...
                </>
              ) : (
                "See Sample Report"
              )}
            </button>
          </div>
        </div>

        <div className="relative mt-14 hidden flex-1 md:mt-10 md:block lg:mt-0">
          <div className="pointer-events-none max-w-lg rotate-1 rounded-xl border border-border bg-white p-2 shadow-xl ring-1 ring-black/5 md:p-3 lg:max-w-none">
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sample output
            </p>
            <div className="overflow-hidden rounded-lg border border-border text-xs">
              <table className="w-full border-collapse">
                <thead className="bg-brand-navy text-left text-[10px] text-white">
                  <tr>
                    <th className="px-2 py-1.5">Risk</th>
                    <th className="px-2 py-1.5">Status</th>
                    <th className="px-2 py-1.5">GSTIN</th>
                    <th className="px-2 py-1.5 text-right">ITC risk</th>
                  </tr>
                </thead>
                <tbody className="text-[10px]">
                  <tr className="bg-[#FFF8F8]">
                    <td className="px-2 py-1.5 font-medium text-red-700">Critical</td>
                    <td className="px-2 py-1.5">Matched</td>
                    <td className="px-2 py-1.5 font-mono">07AAAA…1Z5</td>
                    <td className="px-2 py-1.5 text-right">₹12,000</td>
                  </tr>
                  <tr className="bg-[#FFFAF5]">
                    <td className="px-2 py-1.5 font-medium text-orange-700">High</td>
                    <td className="px-2 py-1.5">In PR Only</td>
                    <td className="px-2 py-1.5 font-mono">27AABCU…1ZM</td>
                    <td className="px-2 py-1.5 text-right">₹45,000</td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-2 py-1.5 font-medium text-amber-800">Medium</td>
                    <td className="px-2 py-1.5">Value Mismatch</td>
                    <td className="px-2 py-1.5 font-mono">29AABCI…1ZD</td>
                    <td className="px-2 py-1.5 text-right">₹2,500</td>
                  </tr>
                  <tr className="bg-emerald-50/80">
                    <td className="px-2 py-1.5 font-medium text-emerald-800">Safe</td>
                    <td className="px-2 py-1.5">Matched</td>
                    <td className="px-2 py-1.5 font-mono">33GSPTN…1ZV</td>
                    <td className="px-2 py-1.5 text-right">₹0</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />
          </div>
        </div>
      </div>
    </section>
  )
}
