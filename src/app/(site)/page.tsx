"use client"

import {
  CheckCircle2,
  FileText,
  Lock,
  ShieldAlert,
  ShieldCheck,
  UserCircle2,
} from "lucide-react"
import { Fragment, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { CTABanner } from "@/components/landing/CTABanner"
import { Features } from "@/components/landing/Features"
import { Hero } from "@/components/landing/Hero"
import { useAuth } from "@/hooks/useAuth"

const MODAL_ITEMS = [
  ["Matched", "Both files agree. Safe to claim ITC.", "No action", "bg-emerald-100 text-emerald-800"],
  ["Value Mismatch", "Taxable value differs by more than ₹1.", "Follow up", "bg-amber-100 text-amber-800"],
  ["Tax Type Mismatch", "IGST vs CGST+SGST split is wrong.", "Follow up", "bg-amber-100 text-amber-800"],
  ["Tax Rate Mismatch", "Effective rate differs between files.", "Follow up", "bg-amber-100 text-amber-800"],
  ["In 2B Only", "In GSTR-2B but not your Purchase Register.", "Follow up", "bg-amber-100 text-amber-800"],
  ["In PR Only", "In your books but supplier hasn't filed.", "Follow up", "bg-amber-100 text-amber-800"],
  ["QRMP Delay", "Quarterly filer — expect next period.", "Next month", "bg-blue-100 text-blue-800"],
  ["Suggested Match", "Fuzzy match despite minor variation.", "Verify", "bg-emerald-100 text-emerald-800"],
  ["Duplicate", "Same invoice appears more than once.", "Act immediately", "bg-red-100 text-red-800"],
  ["RCM Invoice", "Reverse charge — special ITC rules apply.", "Follow up", "bg-amber-100 text-amber-800"],
  ["ITC Blocked", "Supplier has blocked credit (itcavl=N).", "Act immediately", "bg-red-100 text-red-800"],
  ["ITC Temporary", "Provisional ITC availability (itcavl=T).", "Monitor", "bg-amber-100 text-amber-800"],
  ["Section 16(4)", "Beyond ITC claim deadline. May be time-barred.", "Act immediately", "bg-red-100 text-red-800"],
  ["POS Mismatch", "Place of supply conflict between files.", "Follow up", "bg-amber-100 text-amber-800"],
  ["CESS Mismatch", "CESS amount differs between 2B and PR.", "Follow up", "bg-amber-100 text-amber-800"],
  ["Period Timing", "Invoice belongs to a different return period.", "Next period", "bg-blue-100 text-blue-800"],
] as const

type ModalCard = readonly [string, string, string, string]

type ModalSectionConfig = {
  heading: string
  /** Heading label colour */
  labelClassName: string
  items: ModalCard[]
}

const FIRST_CHECKS_SECTION = {
  heading: "✓ MATCHED & FLAGGED",
  labelClassName: "text-green-700",
} as const

const MODAL_EXTRA_SECTIONS: ModalSectionConfig[] = [
  {
    heading: "✓ SMART MATCH",
    labelClassName: "text-blue-700",
    items: [
      [
        "Date Gap Match (M-3)",
        "Invoice and GSTIN match but dates differ beyond 30 days. Still a confirmed match.",
        "Verify period",
        "bg-emerald-100 text-emerald-800",
      ],
      [
        "Group Entity Match (M-4-PAN)",
        "Same PAN, different state GSTIN. Same legal entity under another state registration.",
        "Verify PoS",
        "bg-emerald-100 text-emerald-800",
      ],
      [
        "GSTIN Mismatch Match (M-4)",
        "Invoice number and amounts match but GSTINs differ completely. Verify supplier registration.",
        "Follow up",
        "bg-amber-100 text-amber-800",
      ],
      [
        "Amount-Led Match (M-5)",
        "GSTIN matches and GST amounts agree even though invoice numbers differ.",
        "Verify",
        "bg-amber-100 text-amber-800",
      ],
      [
        "Consolidated Invoice Match (M-6)",
        "One books entry matched to multiple portal invoices that together equal the same total.",
        "Verify",
        "bg-emerald-100 text-emerald-800",
      ],
    ],
  },
  {
    heading: "~ NEEDS REVIEW",
    labelClassName: "text-yellow-700",
    items: [
      [
        "Probable Month Match (P-2)",
        "Same GST amount and same calendar month. Review before claiming ITC — could be coincidence.",
        "Review",
        "bg-amber-100 text-amber-800",
      ],
    ],
  },
  {
    heading: "⚠ ACTION REQUIRED",
    labelClassName: "text-orange-700",
    items: [
      [
        "Unclaimed ITC (Q-8)",
        "An eligible GSTR-2B record exists but ITC has not been booked. Potential missed credit.",
        "Book ITC",
        "bg-orange-100 text-orange-800",
      ],
      [
        "ITC Eligibility Uncertain (Q-9)",
        "Eligibility needs review before claiming. Common with mixed-use purchases.",
        "Review",
        "bg-amber-100 text-amber-800",
      ],
      [
        "Debit Note Misclassified (Q-10)",
        "Portal and books disagree on debit vs credit note. Immediate correction required.",
        "Act immediately",
        "bg-red-100 text-red-800",
      ],
      [
        "Partially Booked ITC (Q-14)",
        "Books GST is less than 90% of the portal amount. Looks like ITC booked in instalments.",
        "Follow up",
        "bg-amber-100 text-amber-800",
      ],
      [
        "ITC Reduced by Supplier (I-8)",
        "Supplier filed a lower ITC amount on the portal than your books show. Claim only the portal amount.",
        "Adjust books",
        "bg-amber-100 text-amber-800",
      ],
    ],
  },
  {
    heading: "⊘ EXCLUDED FROM SCOPE",
    labelClassName: "text-gray-500",
    items: [
      [
        "Non-GST Entry (X-1)",
        "Journal entry with no GSTIN and zero tax. Excluded from reconciliation scope entirely.",
        "Excluded",
        "bg-slate-100 text-slate-700",
      ],
    ],
  },
]

export default function HomePage() {
  const [showModal, setShowModal] = useState(false)
  const { loading, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/dashboard")
    }
  }, [loading, isAuthenticated, router])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible")
            observer.unobserve(e.target)
          }
        })
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    )

    const timer = setTimeout(() => {
      document
        .querySelectorAll(".anim-fade-up, .anim-fade-left, .anim-fade-right, .anim-scale-in")
        .forEach((el) => observer.observe(el))
    }, 100)

    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (!showModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModal(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [showModal])

  if (loading || isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="bg-[#F5F7FA]">
      <style>{`html { scroll-behavior: smooth; }`}</style>
      <Hero />

      <Features onViewAllChecks={() => setShowModal(true)} />

      {showModal && (
        <div
          className="fixed inset-0 z-[200] flex items-stretch justify-center bg-[rgba(15,28,46,.75)] p-0 sm:items-center sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false)
          }}
        >
          <div className="flex max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-none bg-white shadow-xl animate-[scaleIn_.2s_ease_both] sm:max-h-[90vh] sm:rounded-[14px]">
            <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-700 bg-[#0F1C2E] px-4 py-4 sm:px-8 sm:py-5">
              <h3 className="font-sora pr-8 text-sm font-bold text-white sm:text-[15px]">All 28 Reconciliation Checks</h3>
              <button type="button" className="min-h-11 min-w-11 shrink-0 rounded text-xl text-slate-400 hover:text-white sm:min-h-0 sm:min-w-0" aria-label="Close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="col-span-full -mx-4 border-y border-gray-200 bg-slate-50 px-4 py-3 sm:-mx-8 sm:px-8">
                  <p className={`text-xs font-bold uppercase tracking-widest ${FIRST_CHECKS_SECTION.labelClassName}`}>
                    {FIRST_CHECKS_SECTION.heading}
                  </p>
                </div>
                {MODAL_ITEMS.map((item, i) => (
                  <div
                    key={item[0]}
                    className="flex gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:border-gray-300 hover:shadow-md"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F1C2E] text-sm font-bold text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-base font-semibold text-gray-900">{item[0]}</p>
                      <p className="mb-3 text-sm text-gray-500">{item[1]}</p>
                      <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${item[3]}`}>{item[2]}</span>
                    </div>
                  </div>
                ))}
                {(() => {
                  let cardNum = MODAL_ITEMS.length
                  return MODAL_EXTRA_SECTIONS.map((section) => (
                    <Fragment key={section.heading}>
                      <div className="col-span-full -mx-4 border-y border-gray-200 bg-slate-50 px-4 py-3 sm:-mx-8 sm:px-8">
                        <p className={`text-xs font-bold uppercase tracking-widest ${section.labelClassName}`}>
                          {section.heading}
                        </p>
                      </div>
                      {section.items.map((item) => {
                        cardNum += 1
                        return (
                          <div
                            key={`${section.heading}-${item[0]}`}
                            className="flex gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:border-gray-300 hover:shadow-md"
                          >
                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0F1C2E] text-sm font-bold text-white">
                              {cardNum}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="mb-1 text-base font-semibold text-gray-900">{item[0]}</p>
                              <p className="mb-3 text-sm text-gray-500">{item[1]}</p>
                              <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${item[3]}`}>{item[2]}</span>
                            </div>
                          </div>
                        )
                      })}
                    </Fragment>
                  ))
                })()}
              </div>
            </div>
            <div className="sticky bottom-0 z-10 shrink-0 border-t border-gray-200 bg-white px-4 py-4 sm:px-8">
              <p className="mb-3 text-xs font-semibold text-gray-700">What the urgency badges mean</p>
              <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-gray-600">
                <span className="inline-flex max-w-[280px] flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <span className="shrink-0 rounded-full bg-red-600 px-3 py-1 font-medium text-white">Act immediately</span>
                  <span className="text-gray-600">Critical filing or compliance risk — resolve before claiming ITC.</span>
                </span>
                <span className="inline-flex max-w-[280px] flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <span className="shrink-0 rounded-full bg-amber-500 px-3 py-1 font-medium text-white">Follow up</span>
                  <span className="text-gray-600">Supplier or books correction usually needed.</span>
                </span>
                <span className="inline-flex max-w-[280px] flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <span className="shrink-0 rounded-full bg-blue-600 px-3 py-1 font-medium text-white">Next month</span>
                  <span className="text-gray-600">Timing or QRMP — expect resolution in a later period.</span>
                </span>
                <span className="inline-flex max-w-[280px] flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <span className="shrink-0 rounded-full bg-emerald-600 px-3 py-1 font-medium text-white">No action</span>
                  <span className="text-gray-600">Matched or safe to claim as shown.</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <section id="security" className="relative overflow-x-hidden bg-[#0F1C2E] py-12 md:py-16 lg:py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[.07]" style={{ backgroundImage: "radial-gradient(circle,#60A5FA 1px,transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="anim-fade-up">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[2px] text-[#60A5FA]">DATA SECURITY</p>
            <h2 className="font-sora mb-3 text-2xl font-extrabold tracking-tight text-white md:text-3xl lg:text-[30px]">Your client data is protected at every step.</h2>
            <p className="mb-8 max-w-[580px] text-[15px] leading-relaxed text-slate-400">Raw invoice files are never uploaded to our servers. Reconciliation runs in your browser. Only the results are saved — encrypted at rest, isolated to your account, protected by row-level security.</p>
          </div>

          <div className="anim-fade-up mb-7 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-900/20 p-6">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[1.2px] text-emerald-400">Without an account · Guest Mode</p>
              <p className="font-sora mb-2 text-[14px] font-extrabold text-white">Zero server writes. Zero storage.</p>
              <p className="text-[12px] leading-relaxed text-slate-400">Your GSTR-2B and Purchase Register are parsed entirely in your browser tab. Nothing is transmitted to our servers. Close the tab — every trace is gone.</p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />No data leaves your device</span>
            </div>
            <div className="rounded-xl border border-blue-500/20 bg-blue-900/20 p-6">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[1.2px] text-blue-400">With an account · Signed In</p>
              <p className="font-sora mb-2 text-[14px] font-extrabold text-white">Raw files stay local. Results saved securely.</p>
              <p className="text-[12px] leading-relaxed text-slate-400">Invoice files are still parsed client-side — never uploaded. Only reconciliation output (matched rows, ITC risk scores, statuses) is saved. Raw invoice data never touches our servers.</p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-blue-500/25 bg-blue-500/15 px-2.5 py-1 text-[10px] font-bold text-blue-400"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" />Results encrypted · Files never uploaded</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="anim-fade-up stagger-1 rounded-xl border border-white/[.07] bg-white/[.04] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-white/[.14] hover:bg-white/[.08]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/12"><Lock className="h-5 w-5 text-emerald-400" /></div>
              <p className="font-sora mb-1.5 text-[14px] font-bold text-white">Row-Level Security</p>
              <p className="text-[13px] leading-[1.55] text-slate-400">Every database row is locked to your user ID — enforced at the database layer, not the application. No query can return another user's data.</p>
              <span className="mt-2 inline-flex rounded border border-emerald-500/20 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-bold text-emerald-400">ENABLED · VERIFIED</span>
            </div>
            <div className="anim-fade-up stagger-2 rounded-xl border border-white/[.07] bg-white/[.04] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-white/[.14] hover:bg-white/[.08]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/12"><ShieldCheck className="h-5 w-5 text-blue-400" /></div>
              <p className="font-sora mb-1.5 text-[14px] font-bold text-white">TLS 1.3 in Transit</p>
              <p className="text-[13px] leading-[1.55] text-slate-400">All data between your browser and our servers is encrypted with TLS 1.3 — the same standard used by GSTN and Indian banking portals.</p>
              <span className="mt-2 inline-flex rounded border border-blue-500/20 bg-blue-500/12 px-2 py-0.5 text-[10px] font-bold text-blue-400">ACTIVE</span>
            </div>
            <div className="anim-fade-up stagger-3 rounded-xl border border-white/[.07] bg-white/[.04] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-white/[.14] hover:bg-white/[.08]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/12"><FileText className="h-5 w-5 text-amber-400" /></div>
              <p className="font-sora mb-1.5 text-[14px] font-bold text-white">AES-256 at Rest</p>
              <p className="text-[13px] leading-[1.55] text-slate-400">Reconciliation results are encrypted at rest with AES-256. Raw invoice files are never stored — only processed output rows reach the database.</p>
              <span className="mt-2 inline-flex rounded border border-amber-500/20 bg-amber-500/12 px-2 py-0.5 text-[10px] font-bold text-amber-400">AES-256</span>
            </div>
            <div className="anim-fade-up stagger-4 rounded-xl border border-white/[.07] bg-white/[.04] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-white/[.14] hover:bg-white/[.08]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/12"><UserCircle2 className="h-5 w-5 text-emerald-400" /></div>
              <p className="font-sora mb-1.5 text-[14px] font-bold text-white">User-Scoped Isolation</p>
              <p className="text-[13px] leading-[1.55] text-slate-400">Each session is tagged with your user ID. Your data and your clients' data are logically isolated — no cross-contamination possible.</p>
              <span className="mt-2 inline-flex rounded border border-emerald-500/20 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-bold text-emerald-400">USER-SCOPED</span>
            </div>
            <div className="anim-fade-up stagger-5 rounded-xl border border-white/[.07] bg-white/[.04] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-white/[.14] hover:bg-white/[.08]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/12"><CheckCircle2 className="h-5 w-5 text-blue-400" /></div>
              <p className="font-sora mb-1.5 text-[14px] font-bold text-white">Tamper-Proof Audit Trail</p>
              <p className="text-[13px] leading-[1.55] text-slate-400">Every reconciliation gets a unique Request ID, timestamped and immutable. Reference it if you receive a GST notice — always on record.</p>
              <span className="mt-2 inline-flex rounded border border-blue-500/20 bg-blue-500/12 px-2 py-0.5 text-[10px] font-bold text-blue-400">IMMUTABLE LOG</span>
            </div>
            <div className="anim-fade-up stagger-6 rounded-xl border border-white/[.07] bg-white/[.04] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-white/[.14] hover:bg-white/[.08]">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10"><ShieldAlert className="h-5 w-5 text-rose-400" /></div>
              <p className="font-sora mb-1.5 text-[14px] font-bold text-white">No Raw File Storage. Ever.</p>
              <p className="text-[13px] leading-[1.55] text-slate-400">Your GSTR-2B and Purchase Register files are never written to our servers. This is an architectural guarantee, not a policy.</p>
              <span className="mt-2 inline-flex rounded border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-400">ARCHITECTURAL · NOT POLICY</span>
            </div>
          </div>
        </div>
      </section>

      <section id="history" className="overflow-x-hidden bg-white py-12 md:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="anim-fade-up">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[2px] text-[#1447E6]">RECONCILIATION HISTORY</p>
            <h2 className="font-sora mb-2 text-2xl font-extrabold text-[#0F1C2E] md:text-3xl lg:text-[30px]">Every run. Logged. Traceable.</h2>
            <p className="mb-6 text-[15px] text-slate-500">All past reconciliations in one place — with Request IDs to reference if you receive a GST notice.</p>
          </div>
          <div className="anim-fade-up overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex justify-between border-b border-slate-200 px-5 py-3">
              <span className="text-[13px] font-bold text-[#0F1C2E]">Recent Reconciliations</span>
              <span className="text-[11px] text-slate-400">Showing 5 of 24 sessions</span>
            </div>
            <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[800px] border-collapse text-[12px]">
                <thead>
                  <tr>{["Request ID","Client","Period","Invoices","ITC at Risk","Critical","Status","Date"].map((h)=><th key={h} className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[.6px] text-slate-400">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {[
                    ["RECON-20260501-0024","Apex Industries","Apr 2026","412","₹1,24,500","3","Complete","01 May 2026"],
                    ["RECON-20260430-0023","Bharat Steels","Apr 2026","188","₹67,200","1","Complete","30 Apr 2026"],
                    ["RECON-20260428-0022","Sunrise Logistics","Mar 2026","94","₹8,200","0","Complete","28 Apr 2026"],
                    ["RECON-20260425-0021","National Chemicals","Mar 2026","276","₹2,31,000","7","Complete","25 Apr 2026"],
                    ["RECON-20260420-0020","Prism Auto Parts","Feb 2026","341","₹14,800","0","Complete","20 Apr 2026"],
                  ].map((r, i) => (
                    <tr key={i} className="group/row">
                      <td className="border-b border-slate-100 px-4 py-3 font-mono text-[11px] font-bold text-[#1447E6] group-hover/row:bg-slate-50">{r[0]}</td>
                      <td className="border-b border-slate-100 px-4 py-3 text-slate-700 group-hover/row:bg-slate-50">{r[1]}</td>
                      <td className="border-b border-slate-100 px-4 py-3 text-slate-700 group-hover/row:bg-slate-50">{r[2]}</td>
                      <td className="border-b border-slate-100 px-4 py-3 text-slate-700 group-hover/row:bg-slate-50">{r[3]}</td>
                      <td className={`border-b border-slate-100 px-4 py-3 font-bold group-hover/row:bg-slate-50 ${i === 0 || i === 3 ? "text-red-600" : "text-amber-600"}`}>{r[4]}</td>
                      <td className="border-b border-slate-100 px-4 py-3 group-hover/row:bg-slate-50"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${Number(r[5]) >= 3 ? "bg-red-100 text-red-800" : Number(r[5]) >= 1 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{r[5]}</span></td>
                      <td className="border-b border-slate-100 px-4 py-3 group-hover/row:bg-slate-50"><span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">{r[6]}</span></td>
                      <td className="border-b border-slate-100 px-4 py-3 text-slate-700 group-hover/row:bg-slate-50">{r[7]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section id="dashboard" className="overflow-x-hidden bg-slate-50 py-12 md:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="anim-fade-up">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[2px] text-[#1447E6]">CA DASHBOARD</p>
            <h2 className="font-sora mb-2 text-2xl font-extrabold text-[#0F1C2E] md:text-3xl lg:text-[30px]">Your GST compliance command centre.</h2>
            <p className="mb-5 text-[15px] text-slate-500">KPIs, trends, and ITC risk across all your clients — at a glance.</p>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ["Reconciliations","24","This month","text-[#0F1C2E]"],
              ["Total ITC at Risk","₹4.6L","Across all clients","text-red-600"],
              ["Critical Issues","11","Act immediately","text-red-600"],
              ["Active Clients","8","This month","text-[#0F1C2E]"],
            ].map((k, i) => (
              <div key={k[0]} className={`anim-scale-in stagger-${i + 1} rounded-xl border border-slate-200 bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_4px_16px_rgba(15,28,46,.08)]`}>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.5px] text-slate-400">{k[0]}</p>
                <p className={`font-sora text-xl font-extrabold sm:text-2xl lg:text-[28px] ${k[3]}`}>{k[1]}</p>
                <p className="mt-1 text-[11px] text-slate-400">{k[2]}</p>
              </div>
            ))}
          </div>

          <div className="anim-fade-up overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[800px] border-collapse text-[12px]">
                <thead>
                  <tr>{["Client","Last Recon","Period","Matched","ITC at Risk","Critical","Action Required"].map((h)=><th key={h} className="border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-[.6px] text-slate-400">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {[
                    ["Apex Industries","01 May 2026","Apr 2026","389","₹1,24,500","3","Act immediately"],
                    ["National Chemicals","25 Apr 2026","Mar 2026","261","₹2,31,000","7","Act immediately"],
                    ["Bharat Steels","30 Apr 2026","Apr 2026","182","₹67,200","1","Follow up"],
                    ["Prism Auto Parts","20 Apr 2026","Feb 2026","341","₹14,800","0","No action"],
                  ].map((r, i) => (
                    <tr key={i} className="group/row">
                      <td className="border-b border-slate-100 px-4 py-3 text-slate-700 group-hover/row:bg-slate-50">{r[0]}</td>
                      <td className="border-b border-slate-100 px-4 py-3 text-slate-700 group-hover/row:bg-slate-50">{r[1]}</td>
                      <td className="border-b border-slate-100 px-4 py-3 text-slate-700 group-hover/row:bg-slate-50">{r[2]}</td>
                      <td className="border-b border-slate-100 px-4 py-3 font-bold text-emerald-600 group-hover/row:bg-slate-50">{r[3]}</td>
                      <td className={`border-b border-slate-100 px-4 py-3 font-bold group-hover/row:bg-slate-50 ${i < 2 ? "text-red-600" : "text-amber-600"}`}>{r[4]}</td>
                      <td className="border-b border-slate-100 px-4 py-3 group-hover/row:bg-slate-50"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${Number(r[5]) >= 3 ? "bg-red-100 text-red-800" : Number(r[5]) >= 1 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{r[5]}</span></td>
                      <td className="border-b border-slate-100 px-4 py-3 group-hover/row:bg-slate-50"><span className={`rounded px-2 py-0.5 text-[10px] font-bold ${r[6] === "Act immediately" ? "bg-red-100 text-red-800" : r[6] === "Follow up" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{r[6]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section id="gstr3b" className="overflow-x-hidden bg-white py-12 md:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="anim-fade-up">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[2px] text-[#1447E6]">GSTR-3B OUTPUT</p>
            <h2 className="font-sora mb-2 text-2xl font-extrabold text-[#0F1C2E] md:text-3xl lg:text-[30px]">Filing-ready ITC summary. Automatically.</h2>
            <p className="mb-6 text-[15px] text-slate-500">GST Shield maps reconciled results to GSTR-3B Table 4 — ITC numbers ready before you open the portal.</p>
          </div>
          <div className="anim-scale-in w-full max-w-[480px] rounded-[14px] bg-[#0F1C2E] p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[.8px] text-slate-400">GSTR-3B · Table 4 Summary</span>
              <span className="rounded bg-blue-700 px-2.5 py-0.5 text-[10px] font-bold text-white">AUTO-GENERATED</span>
            </div>
            <div className="text-[12px] text-slate-400">
              <div className="flex justify-between border-b border-slate-800 py-3"><span>4(A) Eligible ITC — Matched · Safe</span><span className="text-[14px] font-bold text-emerald-400">₹4,82,500</span></div>
              <div className="flex justify-between border-b border-slate-800 py-3"><span>4(B) ITC Reversed — Blocked · Critical</span><span className="text-[14px] font-bold text-red-400">−₹12,000</span></div>
              <div className="flex justify-between border-b border-slate-800 py-3"><span>Pending Recovery — High + Medium</span><span className="text-[14px] font-bold text-amber-400">₹47,500</span></div>
              <div className="flex justify-between border-b border-slate-800 py-3"><span>QRMP — Expected Next Period</span><span className="text-[14px] font-bold text-white">₹8,200</span></div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-700 pt-5">
              <span className="text-[12px] text-slate-500">Net Eligible ITC to Claim</span>
              <span className="font-sora text-[26px] font-extrabold text-emerald-400">₹4,70,500</span>
            </div>
          </div>
        </div>
      </section>

      <CTABanner />
    </div>
  )
}
