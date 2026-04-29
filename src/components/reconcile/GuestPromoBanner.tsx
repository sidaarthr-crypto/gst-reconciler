"use client"

import Link from "next/link"
import { Gift, X } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function GuestPromoBanner({
  onDismiss,
  used,
  limit,
}: {
  onDismiss: () => void
  used: number
  limit: number
}) {
  const remaining = Math.max(0, limit - used)
  const tone =
    used >= limit
      ? {
          wrap: "border-red-300 border-l-red-600 bg-red-50",
          icon: "text-red-600",
          title: `You've used all ${limit} free reconciliations.`,
          body: "Sign up free to continue.",
        }
      : used === limit - 1
        ? {
            wrap: "border-orange-300 border-l-orange-500 bg-orange-50",
            icon: "text-orange-600",
            title: `This was your ${used}th reconciliation. Only 1 free reconciliation remaining.`,
            body: "Sign up free to continue after next.",
          }
        : used >= limit - 4
          ? {
              wrap: "border-amber-300 border-l-amber-500 bg-amber-50",
              icon: "text-amber-600",
              title: `You have ${remaining} reconciliations left on the free plan.`,
              body: "Sign up free to get unlimited access.",
            }
          : {
              wrap: "border-brand-blue/30 border-l-brand-blue bg-[#EFF6FF]",
              icon: "text-brand-blue",
              title: `You have used ${used} of ${limit} free reconciliations.`,
              body: "Sign up free to save your history.",
            }

  return (
    <div className={cn("relative rounded-lg border border-l-4 px-5 py-3.5 pr-12", tone.wrap)}>
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-3 top-3 rounded-md p-1 text-brand-navy/60 hover:bg-white/60 hover:text-brand-navy"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:pr-4">
        <div className="flex gap-3">
          <Gift className={cn("mt-0.5 h-5 w-5 shrink-0", tone.icon)} aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-brand-navy">{tone.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tone.body}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:pl-2">
          <Link
            href="/auth/register"
            className={cn(
              buttonVariants({ size: "sm" }),
              "bg-brand-blue text-white hover:bg-brand-blue/90",
            )}
          >
            Sign up free <span aria-hidden>→</span>
          </Link>
          <Link
            href="/auth/login"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "border-brand-navy")}
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  )
}
