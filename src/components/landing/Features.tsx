"use client"

import { cn } from "@/lib/utils"

type FeaturesProps = {
  onViewAllChecks: () => void
}

export function Features({ onViewAllChecks }: FeaturesProps) {
  return (
    <section id="features" className="bg-slate-50 px-12 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="anim-fade-up">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[2px] text-[#1447E6]">FEATURES</p>
          <h2 className="font-sora mb-2 text-4xl font-bold tracking-[-0.6px] text-[#0F1C2E]">
            Built for CAs. Designed for real GST compliance.
          </h2>
          <p className="mb-8 text-base leading-relaxed text-gray-600">
            Every invoice scored, categorised, and given a plain-English action — before you file GSTR-3B.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-12 md:grid-cols-2">
          <div className="anim-fade-left">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[.8px] text-slate-400">ITC RISK LEVELS</p>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Critical", "ITC blocked or permanently denied. Cannot claim under any scenario.", "bg-red-600 text-white", "border-l-red-600", "Act immediately", "#DC2626", "text-red-700"],
                ["High", "Invoice missing from 2B. Supplier hasn't filed. ITC at risk this period.", "bg-amber-500 text-white", "border-l-amber-600", "Follow up now", "#D97706", "text-amber-700"],
                ["Medium", "Value or tax mismatch. Claimable only after correction from supplier.", "bg-orange-500 text-white", "border-l-orange-600", "Follow up", "#EA580C", "text-orange-700"],
                ["Low", "QRMP delay or timing difference. Likely in next month's 2B.", "bg-blue-600 text-white", "border-l-blue-700", "Next month", "#2563EB", "text-blue-700"],
              ].map(([name, desc, pill, border, badge, dot, nameColor]) => (
                <div
                  key={String(name)}
                  className={`flex min-h-[120px] flex-col rounded-xl border border-slate-200 border-l-4 ${border} bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_4px_16px_rgba(15,28,46,.08)]`}
                >
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: String(dot) }} />
                    <p className={`font-sora text-lg font-semibold ${nameColor}`}>{name}</p>
                  </div>
                  <p className="flex-1 text-sm leading-relaxed text-slate-500">{desc}</p>
                  <span className={`mt-2 inline-block rounded px-4 py-1.5 text-[10px] font-bold ${pill}`}>{badge}</span>
                </div>
              ))}
              <div className="col-span-2 flex min-h-[120px] items-start justify-between rounded-xl border border-slate-200 border-l-4 border-l-emerald-700 bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_4px_16px_rgba(15,28,46,.08)]">
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    <p className="font-sora text-lg font-semibold text-emerald-700">Safe</p>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-500">
                    Fully matched and verified. ITC claimable without any action required.
                  </p>
                </div>
                <span className="ml-4 flex-shrink-0 rounded bg-emerald-600 px-4 py-1.5 text-[10px] font-bold text-white">
                  No action needed
                </span>
              </div>
            </div>
          </div>

          <div id="recon" className="anim-fade-right">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[.8px] text-slate-400">RECONCILIATION ENGINE</p>
            <div className="rounded-xl border border-slate-200 bg-white p-8 animate-[borderGlow_3s_infinite]">
              <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">WHAT WE DO</p>
              <h3 className="font-sora mb-3 text-2xl font-bold text-[#0F1C2E]">28-Point Invoice Reconciliation</h3>
              <p className="mb-5 text-base leading-relaxed text-slate-500">
                Every B2B invoice is normalised, matched by GSTIN + Invoice Number, then compared across value, tax type, tax rate, ITC availability, place of supply, CESS, return period, RCM status, advanced matching, query checks, and exclusions — with a ₹1 tolerance built in.
              </p>
              <div className="mb-5 flex items-baseline gap-2.5">
                <span className="font-sora text-6xl font-bold leading-none text-[#1447E6]">28</span>
                <span className="text-sm text-slate-400">diagnostic checks / per invoice</span>
              </div>
              <div className="mb-5 flex flex-wrap gap-2">
                {["Matched", "Value Mismatch", "ITC Blocked", "In PR Only", "In 2B Only", "QRMP Delay", "RCM Invoice", "Section 16(4)", "+ 8 more →"].map((chip) => (
                  <span
                    key={chip}
                    className={cn(
                      "rounded-md bg-slate-100 px-3 py-1 font-semibold text-slate-500",
                      chip === "+ 8 more →" ? "text-base" : "text-sm",
                    )}
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={onViewAllChecks}
                className="w-full rounded-[9px] bg-[#0F1C2E] py-4 text-base font-semibold text-white transition-all duration-200 hover:-translate-y-px hover:bg-[#1a3050] hover:shadow-[0_4px_14px_rgba(15,28,46,.2)]"
              >
                View all 28 reconciliation checks →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
