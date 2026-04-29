/** Legacy key used in older builds (single-use boolean gate). */
export const LEGACY_GUEST_USAGE_STORAGE_KEY = "gstrecon_guest_used"
/** Current key storing guest reconciliation count. */
export const GUEST_USAGE_STORAGE_KEY = "gstrecon_guest_count"

export function migrateGuestStorage(): void {
  try {
    const oldVal = localStorage.getItem(LEGACY_GUEST_USAGE_STORAGE_KEY)
    const newVal = localStorage.getItem(GUEST_USAGE_STORAGE_KEY)
    if (oldVal === "true" && !newVal) {
      localStorage.setItem(GUEST_USAGE_STORAGE_KEY, "1")
    }
    if (oldVal !== null) {
      localStorage.removeItem(LEGACY_GUEST_USAGE_STORAGE_KEY)
    }
  } catch {
    // localStorage may be unavailable in private mode.
  }
}

export function getGuestCount(): number {
  try {
    const stored = localStorage.getItem(GUEST_USAGE_STORAGE_KEY)
    const parsed = Number.parseInt(stored ?? "0", 10)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  } catch {
    return 0
  }
}

export function setGuestCount(next: number): void {
  try {
    const value = Math.max(0, Math.trunc(next))
    localStorage.setItem(GUEST_USAGE_STORAGE_KEY, String(value))
  } catch {
    // localStorage may be unavailable in private mode.
  }
}

export function incrementGuestCount(): number {
  const current = getGuestCount()
  const next = current + 1
  setGuestCount(next)
  return next
}
