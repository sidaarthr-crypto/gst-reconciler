/** URL query e.g. `042024` → April 2024 */
export function parsePeriodQuery(s: string | null | undefined): {
  month: number
  year: number
} | null {
  if (!s || !/^\d{6}$/.test(s)) return null
  const month = Number.parseInt(s.slice(0, 2), 10)
  const year = Number.parseInt(s.slice(2), 10)
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null
  return { month, year }
}

export function formatPeriodQuery(month: number, year: number): string {
  return `${String(month).padStart(2, "0")}${year}`
}
