import type { User } from "@supabase/supabase-js"

/** Single-token prefixes to skip so "CA Sidaarth Rajan" → "Sidaarth", not "CA". */
const NAME_PREFIX_SKIP = new Set(["ca", "dr", "mr", "mrs", "ms", "prof"])

function firstNameFromFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ""

  let i = 0
  while (i < parts.length) {
    const token = parts[i]!.replace(/\.$/, "").toLowerCase()
    if (NAME_PREFIX_SKIP.has(token) && i < parts.length - 1) {
      i++
      continue
    }
    break
  }

  return parts[i] ?? parts[0] ?? ""
}

export function computeDisplayName(user: User | null): string {
  if (!user) return "User"

  const meta = user.user_metadata as { full_name?: unknown; name?: unknown } | undefined
  const rawFull = meta?.full_name ?? meta?.name
  const fullName = typeof rawFull === "string" ? rawFull.trim() : ""

  if (fullName) {
    return firstNameFromFullName(fullName) || fullName.split(/\s+/)[0] || "there"
  }

  if (user.email) {
    const beforeAt = user.email.split("@")[0] ?? ""
    const cleaned = beforeAt.split(/[._]/)[0] ?? ""
    if (!cleaned) return "there"
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase()
  }

  return "there"
}

export { AuthProvider, useAuth } from "./auth-context"
