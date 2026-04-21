"use client"

import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getMonthName } from "@/lib/utils"

const YEAR_MIN = 2017
const YEAR_MAX = 2030

export function MonthPicker({
  month,
  year,
  onChange,
}: {
  month: number
  year: number
  onChange: (next: { month: number; year: number }) => void
}) {
  const years = Array.from(
    { length: YEAR_MAX - YEAR_MIN + 1 },
    (_, i) => YEAR_MIN + i,
  )

  return (
    <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:flex-wrap md:items-end">
      <div className="min-w-0 flex-1 space-y-1.5 md:flex-initial">
        <Label className="text-xs text-muted-foreground">Month</Label>
        <Select
          value={String(month)}
          onValueChange={(v) => onChange({ month: Number(v), year })}
        >
          <SelectTrigger className="h-11 w-full md:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <SelectItem key={m} value={String(m)}>
                {getMonthName(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5 md:flex-initial">
        <Label className="text-xs text-muted-foreground">Year</Label>
        <Select
          value={String(year)}
          onValueChange={(v) => onChange({ month, year: Number(v) })}
        >
          <SelectTrigger className="h-11 w-full md:w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
