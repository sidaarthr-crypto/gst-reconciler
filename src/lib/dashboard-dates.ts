import {
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
} from "date-fns"

export function formatDashboardRequestDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "—"
  if (isToday(d)) return formatDistanceToNow(d, { addSuffix: true })
  if (isYesterday(d)) return "Yesterday"
  const ageMs = Date.now() - d.getTime()
  if (ageMs >= 0 && ageMs < 7 * 24 * 60 * 60 * 1000) {
    return formatDistanceToNow(d, { addSuffix: true })
  }
  return format(d, "d MMM yyyy")
}
