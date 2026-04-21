import { cn } from "@/lib/utils"

export const authInputClass = cn(
  "flex h-11 w-full rounded-lg border border-input bg-white px-3 text-sm shadow-sm outline-none transition",
  "placeholder:text-muted-foreground focus-visible:border-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue/25",
  "disabled:cursor-not-allowed disabled:opacity-50",
)

export const authCardClass = cn(
  "mx-4 rounded-none border-0 border-t-[4px] border-t-brand-navy bg-white p-6 shadow-none md:mx-0 md:rounded-2xl md:border md:p-10 md:shadow-[0_4px_24px_rgba(0,0,0,0.08)]",
)
