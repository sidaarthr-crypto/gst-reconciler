import { cn } from "@/lib/utils"

export const authInputClass = cn(
  "flex h-11 w-full rounded-lg border border-input bg-white px-3 text-sm shadow-sm outline-none transition",
  "placeholder:text-muted-foreground focus-visible:border-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue/25",
  "disabled:cursor-not-allowed disabled:opacity-50",
)

export const authCardClass = cn(
  "rounded-2xl border border-border border-t-[4px] border-t-brand-navy bg-white p-10 shadow-[0_4px_24px_rgba(0,0,0,0.08)]",
)
