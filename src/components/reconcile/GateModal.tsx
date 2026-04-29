"use client"

import Link from "next/link"
import { Check, Lock } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function GateModal() {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/50 p-0 md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-title"
    >
      <div className="flex w-full max-w-md flex-col overflow-y-auto rounded-none bg-white p-6 shadow-xl md:max-h-[min(720px,90vh)] md:rounded-2xl md:p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-blue-lt">
          <Lock className="h-10 w-10 text-brand-blue" aria-hidden />
        </div>
        <h2
          id="gate-title"
          className="mt-6 text-center text-xl font-bold text-brand-navy"
        >
          You&apos;ve used all 15 free reconciliations
        </h2>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Sign up free to continue reconciling without limits.
        </p>
        <ul className="mt-6 space-y-2.5 text-sm text-brand-navy">
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <span>Unlimited reconciliations</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <span>Full reconciliation history</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <span>Customer dashboard</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <span>Download Excel reports</span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            <span>Save and revisit past sessions</span>
          </li>
        </ul>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/auth/register"
            className={cn(
              buttonVariants({ size: "lg" }),
              "flex h-11 w-full items-center justify-center bg-brand-blue font-semibold text-white hover:bg-brand-blue/90",
            )}
          >
            Create Free Account <span aria-hidden>→</span>
          </Link>
          <Link
            href="/auth/login"
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "flex h-11 w-full items-center justify-center border-brand-navy text-brand-navy",
            )}
          >
            Sign In
          </Link>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          100% free. No credit card required.
        </p>
      </div>
    </div>
  )
}
