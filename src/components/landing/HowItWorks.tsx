export function HowItWorks() {
  const steps = [
    {
      title: "Upload Files",
      body: "GSTR-2B + Purchase Register. Excel or CSV.",
    },
    {
      title: "Auto Reconcile",
      body: "Matches every B2B invoice. Flags mismatches.",
    },
    {
      title: "Download Report",
      body: "Colour-coded Excel with ITC risk + actions.",
    },
  ]
  return (
    <section className="bg-surface-2 py-16">
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <h2 className="text-center text-3xl font-bold text-brand-navy">How it works</h2>
        <div className="relative mt-12 grid gap-10 md:grid-cols-3">
          <div
            className="pointer-events-none absolute left-[16%] right-[16%] top-8 hidden h-px bg-border-strong lg:block"
            aria-hidden
          />
          {steps.map((s, i) => (
            <div key={s.title} className="relative text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-brand-blue bg-white text-lg font-bold text-brand-blue shadow-sm">
                {i + 1}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-brand-navy">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
