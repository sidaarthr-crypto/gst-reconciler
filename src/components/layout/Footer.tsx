export function Footer() {
  return (
    <footer className="flex max-w-full flex-col gap-4 border-t border-slate-800 bg-[#060E1A] px-4 py-8 font-dm sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 lg:px-8">
      <p className="shrink-0 text-sm font-semibold text-slate-400">GSTRecon · v1.0.0</p>
      <p className="max-w-full text-sm leading-relaxed text-slate-400 sm:max-w-[420px] sm:text-right">
        Figures are indicative; always validate against GSTN records before filing. © 2026 GSTRecon.
      </p>
    </footer>
  )
}
