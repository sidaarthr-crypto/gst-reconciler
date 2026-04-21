"use client"

import Link from "next/link"
import { Gift, X } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function GuestPromoBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="relative rounded-lg border-l-4 border-brand-blue bg-[#EFF6FF] px-5 py-3.5 pr-12">
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
          <Gift className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-brand-navy">You&apos;ve used your 1 free reconciliation</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign up free to reconcile every month, save your history, and access your Request IDs
              anytime.
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
            Sign Up Free
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
