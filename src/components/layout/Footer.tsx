export function Footer() {
  return (
    <footer className="flex items-center justify-between border-t border-slate-800 bg-[#060E1A] px-8 py-6 font-dm">
      <p className="text-sm font-semibold text-slate-400">GSTRecon · v1.0.0</p>
      <p className="max-w-[420px] text-right text-sm leading-relaxed text-slate-400">
        Figures are indicative; always validate against GSTN records before filing. © 2026 GSTRecon.
      </p>
    </footer>
  )
}
