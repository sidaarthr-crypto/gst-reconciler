import { Database, Lightbulb, Shield } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

const items = [
  {
    title: "Instant Risk Scoring",
    icon: Shield,
    accent: "text-brand-blue",
    body: "Know exactly which invoices risk your ITC — Critical, High, Medium, Safe — before GSTR-3B.",
  },
  {
    title: "Plain English Actions",
    icon: Lightbulb,
    accent: "text-risk-medium",
    body: "Every mismatch gets a specific action: who to follow up with, what to fix, and when.",
  },
  {
    title: "Full Audit Trail",
    icon: Database,
    accent: "text-risk-safe",
    body: "Every reconciliation is logged with a unique Request ID. Reference it if you get a GST notice.",
  },
] as const

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h2 className="text-center text-3xl font-bold text-brand-navy">
        Built for how CAs actually work
      </h2>
      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {items.map((f) => (
          <Card key={f.title} className="border-border shadow-sm">
            <CardContent className="p-6">
              <f.icon className={`h-10 w-10 ${f.accent}`} aria-hidden />
              <h3 className="mt-4 text-lg font-semibold text-brand-navy">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
