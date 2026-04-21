"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"

import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

/** Two-step progress while reconciliation runs (DB save is silent). */
export function ProcessingState() {
  const [step1Done, setStep1Done] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setStep1Done(true), 420)
    return () => window.clearTimeout(t)
  }, [])

  const progress = step1Done ? 82 : 38

  return (
    <div className="card mx-auto max-w-lg p-8">
      <h2 className="text-center text-lg font-semibold text-brand-navy">
        Working on your reconciliation
      </h2>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        This usually takes a few seconds. Please keep this tab open.
      </p>

      <div className="mt-8 space-y-5">
        <StepRow
          icon={
            step1Done ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-brand-blue" />
            )
          }
          title="Parsing your files..."
          active={!step1Done}
        />
        <StepRow
          icon={
            step1Done ? (
              <Loader2 className="h-5 w-5 animate-spin text-brand-blue" />
            ) : (
              <div
                className="h-5 w-5 shrink-0 rounded-full border-2 border-muted-foreground/30"
                aria-hidden
              />
            )
          }
          title="Matching invoices..."
          active={step1Done}
        />
      </div>

      <Progress value={progress} className="mt-8 h-2" />
    </div>
  )
}

function StepRow({
  icon,
  title,
  active,
}: {
  icon: React.ReactNode
  title: string
  active: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-surface-2/60 px-3 py-2.5",
        active && "border-brand-blue/40 bg-brand-blue-lt/40",
      )}
    >
      {icon}
      <div className="flex-1 text-sm font-medium text-brand-navy">{title}</div>
    </div>
  )
}
