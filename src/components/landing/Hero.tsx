"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

export function Hero() {
  const router = useRouter()
  const [navBusy, setNavBusy] = useState<"primary" | "secondary" | null>(null)
  const runIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const invoiceRows = [
    { gstin: "27AABCU...1ZM", inv: "INV-2024-0041", status: "Matched" },
    { gstin: "29AABCI...1ZD", inv: "BSW/23-887", status: "Mismatch" },
    { gstin: "07AAACR...1ZP", inv: "NCC/INV/2091", status: "Blocked" },
    { gstin: "33AABCP...1ZV", inv: "SRL-887-2024", status: "Matched" },
    { gstin: "19AABCF...1ZQ", inv: "PAP-Q2-0334", status: "Delayed" },
    { gstin: "27AABCU...1ZM", inv: "INV-2024-0099", status: "Matched" },
    { gstin: "29AABCI...1ZD", inv: "BSW/23-991", status: "Matched" },
    { gstin: "07AAACR...1ZP", inv: "NCC/INV/3001", status: "Mismatch" },
    { gstin: "33AABCP...1ZV", inv: "SRL-991-2024", status: "Matched" },
    { gstin: "19AABCF...1ZQ", inv: "PAP-Q3-0441", status: "Blocked" },
    { gstin: "27AABCU...1ZM", inv: "INV-2024-0201", status: "Matched" },
    { gstin: "29AABCI...1ZD", inv: "BSW/24-001", status: "Matched" },
  ] as const

  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState("Parsing files...")
  const [scrollOffset, setScrollOffset] = useState(0)
  const [done, setDone] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [matchedCount, setMatchedCount] = useState(0)
  const [mismatchCount, setMismatchCount] = useState(0)
  const [blockedCount, setBlockedCount] = useState(0)

  const headlines = [
    { line1: "Reconcile GST", line2: "in 60 seconds." },
    { line1: "Catch every ITC mismatch", line2: "before GSTR-3B filing." },
  ]
  const [headlineIndex, setHeadlineIndex] = useState(0)
  const [headlineVisible, setHeadlineVisible] = useState(true)

  const labels = [
    "Parsing files...",
    "Normalising GSTINs...",
    "Building match keys...",
    "Comparing values...",
    "Scoring ITC risk...",
    "Generating report...",
    "Complete!",
  ]

  function goReconcile(which: "primary" | "secondary") {
    if (navBusy) return
    setNavBusy(which)
    window.setTimeout(() => {
      router.push("/reconcile")
    }, 0)
  }

  useEffect(() => {
    let p = 0
    let offset = 0
    let start = Date.now()

    const run = () => {
      if (runIntervalRef.current) {
        clearInterval(runIntervalRef.current)
      }

      setProgress(0)
      setScrollOffset(0)
      setDone(false)
      setElapsed(0)
      setMatchedCount(0)
      setMismatchCount(0)
      setBlockedCount(0)
      setProgressLabel("Parsing files...")
      p = 0
      offset = 0
      start = Date.now()

      runIntervalRef.current = setInterval(() => {
        p += Math.random() * 3 + 1.5
        if (p >= 100) {
          p = 100
          if (runIntervalRef.current) {
            clearInterval(runIntervalRef.current)
            runIntervalRef.current = null
          }
          const secs = ((Date.now() - start) / 1000).toFixed(1)
          setElapsed(Number(secs))
          setMatchedCount(847)
          setMismatchCount(23)
          setBlockedCount(4)
          setDone(true)
        }
        setProgress(Math.min(Math.round(p), 100))
        const labelIdx = Math.min(Math.floor(p / 17), labels.length - 1)
        setProgressLabel(labels[labelIdx])
        offset += 28
        setScrollOffset(offset)
      }, 120)
    }

    run()
    const restart = setInterval(run, 8000)

    return () => {
      if (runIntervalRef.current) {
        clearInterval(runIntervalRef.current)
      }
      clearInterval(restart)
    }
  }, [])

  useEffect(() => {
    let fadeTimeoutId: ReturnType<typeof setTimeout>
    const interval = setInterval(() => {
      setHeadlineVisible(false)
      fadeTimeoutId = setTimeout(() => {
        setHeadlineIndex((i) => (i + 1) % headlines.length)
        setHeadlineVisible(true)
      }, 500)
    }, 3500)
    return () => {
      clearInterval(interval)
      clearTimeout(fadeTimeoutId)
    }
  }, [])

  return (
    <section className="relative overflow-hidden bg-white">
      <div
        aria-hidden
        className="dot-bg pointer-events-none absolute inset-0 opacity-[.32]"
        style={{
          backgroundImage: "radial-gradient(circle,#CBD5E1 1px,transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-116px)] max-w-[1200px] items-center px-12">
        <div className="grid w-full grid-cols-2 items-center gap-20 py-20">
          <div className="max-w-[520px]">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[.4px] text-blue-700">
              <span className="h-[7px] w-[7px] rounded-full bg-blue-700" />
              GST Compliance Platform · India
            </div>

            <h1
              style={{
                fontFamily: "Sora, sans-serif",
                fontSize: "48px",
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: "-1.5px",
                color: "#0F1C2E",
                marginBottom: "16px",
                opacity: headlineVisible ? 1 : 0,
                transform: headlineVisible ? "translateY(0)" : "translateY(10px)",
                transition: "opacity 0.5s ease, transform 0.5s ease",
                minHeight: "110px",
              }}
            >
              {headlines[headlineIndex].line1}
              <br />
              <em style={{ color: "#1447E6", fontStyle: "normal" }}>{headlines[headlineIndex].line2}</em>
            </h1>

            <p
              style={{
                fontSize: "1.0625rem",
                color: "#64748B",
                lineHeight: 1.6,
                maxWidth: "520px",
                marginBottom: "28px",
              }}
            >
              Upload your GSTR-2B and Purchase Register. GSTRecon runs 28 reconciliation checks,
              scores every invoice by ITC risk, and tells you exactly what to do — before you file
              GSTR-3B.
            </p>

            <div className="mb-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={navBusy !== null}
                onClick={() => goReconcile("primary")}
                className="rounded-[9px] border-none bg-[#1447E6] px-8 py-4 text-[14px] font-bold text-white transition-all duration-200 hover:-translate-y-px hover:bg-[#0F3DD4] hover:shadow-[0_6px_20px_rgba(20,71,230,.35)]"
              >
                {navBusy === "primary" ? (
                  <>
                    <span
                      className="mr-2 inline-block h-4 w-4 rounded-full border-2 border-current align-middle opacity-70"
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
                className="rounded-[9px] border-[1.5px] border-slate-300 bg-white px-8 py-4 text-[14px] font-semibold text-[#0F1C2E] transition-all duration-200 hover:border-slate-500 hover:bg-slate-50"
              >
                {navBusy === "secondary" ? (
                  <>
                    <span
                      className="mr-2 inline-block h-4 w-4 rounded-full border-2 border-current align-middle opacity-70"
                      aria-hidden
                    />
                    Opening...
                  </>
                ) : (
                  "See Sample Report"
                )}
              </button>
            </div>

            <div className="mb-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[12px] font-bold text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                First 15 reconciliations free — no sign up required
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col justify-center gap-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span className="text-[12px] font-bold uppercase tracking-[1.5px] text-slate-400">
                Live Reconciliation
              </span>
            </div>

            <div className="w-full max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_60px_rgba(15,28,46,.12)]">
              <div className="flex items-center justify-between bg-[#0F1C2E] px-5 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <span className="font-mono text-[11px] text-slate-400">gst-shield · reconcile</span>
                <div className="w-16" />
              </div>

              <div className="px-6 py-6">
                <div className="mb-4 flex gap-3">
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14,2 14,8 20,8" />
                    </svg>
                    GSTR-2B.xlsx
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14,2 14,8 20,8" />
                    </svg>
                    PurchaseReg.csv
                  </div>
                </div>

                <div className="mb-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500">{progressLabel}</span>
                    <span className="font-mono text-[11px] font-bold text-[#1447E6]">{progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#1447E6] transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="relative h-[200px] overflow-hidden rounded-xl border border-slate-100 bg-[#F8FAFC]">
                  <div
                    className="absolute inset-x-0 transition-transform duration-500 ease-linear"
                    style={{ transform: `translateY(-${scrollOffset}px)` }}
                  >
                    {invoiceRows.map((row, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between border-b border-slate-100 px-3 py-2 last:border-b-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-slate-400">{row.gstin}</span>
                          <span className="text-[10px] font-semibold text-slate-600">{row.inv}</span>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            row.status === "Matched"
                              ? "bg-emerald-100 text-emerald-700"
                              : row.status === "Mismatch"
                                ? "bg-amber-100 text-amber-700"
                                : row.status === "Blocked"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {row.status}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="pointer-events-none absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-[#F8FAFC] to-transparent" />
                </div>
              </div>

              <div
                className={`px-5 pb-5 transition-all duration-700 ${
                  done ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                }`}
              >
                <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 12L11 14L15 10"
                        stroke="#059669"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="12" r="9" stroke="#059669" strokeWidth="2" />
                    </svg>
                    <span className="text-[12px] font-bold text-emerald-800">Reconciliation complete</span>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-emerald-600">{elapsed}s</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center">
                    <div className="font-sora text-[18px] font-bold text-emerald-600">{matchedCount}</div>
                    <div className="text-[10px] font-semibold text-slate-400">Matched</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center">
                    <div className="font-sora text-[18px] font-bold text-amber-500">{mismatchCount}</div>
                    <div className="text-[10px] font-semibold text-slate-400">Mismatch</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center">
                    <div className="font-sora text-[18px] font-bold text-red-500">{blockedCount}</div>
                    <div className="text-[10px] font-semibold text-slate-400">Blocked</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-1 flex items-center gap-3">
              <div className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0F1C2E] px-4 py-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="#3B82F6" strokeWidth="1.5" />
                  <path d="M12 7V12L15 15" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span className="text-[13px] font-bold text-white">Under 60 seconds</span>
              </div>
              <div className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 12L11 14L15 10"
                    stroke="#059669"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="12" r="9" stroke="#059669" strokeWidth="2" />
                </svg>
                <span className="text-[13px] font-bold text-slate-700">Up to 10,000 invoices</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
