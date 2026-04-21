const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "GSTRecon"
const version = process.env.NEXT_PUBLIC_APP_VERSION ?? ""

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface-2 py-10 text-center text-sm text-muted-foreground">
      <p className="font-medium text-brand-navy">
        {appName}
        {version ? ` · v${version}` : ""}
      </p>
      <p className="mt-2 max-w-xl mx-auto px-4">
        GST reconciliation tooling for chartered accountants. Figures are indicative;
        always validate against GSTN records before filing.
      </p>
      <p className="mt-4 text-xs">
        © {new Date().getFullYear()} {appName}. Built for the Indian GST ecosystem.
      </p>
    </footer>
  )
}
