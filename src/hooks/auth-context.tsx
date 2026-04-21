"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { Session, User } from "@supabase/supabase-js"

import { GUEST_USAGE_STORAGE_KEY } from "@/lib/guest-usage"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { computeDisplayName } from "./useAuth"

type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  isAuthenticated: boolean
  signOut: () => Promise<void>
  displayName: string
  initials: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

function computeInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  }
  const p = parts[0] ?? "U"
  return p.slice(0, 2).toUpperCase()
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    let cancelled = false

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (cancelled) return
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    try {
      localStorage.removeItem(GUEST_USAGE_STORAGE_KEY)
    } catch {
      /* private mode */
    }
    window.location.href = "/"
  }, [])

  const displayName = useMemo(() => computeDisplayName(user), [user])
  const initials = useMemo(() => computeInitials(displayName), [displayName])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      loading,
      isAuthenticated: !!user,
      signOut,
      displayName,
      initials,
    }),
    [user, session, loading, signOut, displayName, initials],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
