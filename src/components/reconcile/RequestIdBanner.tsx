"use client"

import { useState } from "react"
import { CheckCircle2, Copy, Info } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function RequestIdBanner({ requestId }: { requestId: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(requestId)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Could not copy to clipboard. Please copy the ID manually.")
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border border-l-4 border-l-brand-blue bg-brand-blue-lt p-4 md:flex-row md:items-center md:justify-between md:gap-6">
      <div className="flex min-w-0 gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" aria-hidden />
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your Reconciliation ID
          </p>
          <p className="break-all font-mono text-lg font-semibold text-brand-navy">{requestId}</p>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Save this ID to retrieve your report later. Use it to filter when history is
            available.
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className={cn(
          "h-11 min-w-[112px] w-full shrink-0 border-brand-blue hover:bg-white md:h-10 md:w-auto",
          copied ? "border-emerald-600 text-emerald-700" : "text-brand-blue",
        )}
        onClick={copy}
      >
        {copied ? (
          <span className="inline-flex items-center justify-center gap-2 font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            Copied!
          </span>
        ) : (
          <span className="inline-flex items-center justify-center gap-2">
            <Copy className="h-4 w-4 shrink-0" aria-hidden />
            Copy ID
          </span>
        )}
      </Button>
    </div>
  )
}
