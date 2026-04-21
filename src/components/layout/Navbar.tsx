"use client"

import { startTransition, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BarChart3, LogOut, Settings } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "GSTRecon"

export function Navbar({ className }: { className?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { loading, isAuthenticated, signOut, displayName, initials, user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [reconcileLoading, setReconcileLoading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    startTransition(() => setMenuOpen(false))
  }, [pathname])

  useEffect(() => {
    setReconcileLoading(false)
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocMouseDown)
    return () => document.removeEventListener("mousedown", onDocMouseDown)
  }, [menuOpen])

  async function onSignOut() {
    if (signOutBusy) return
    setSignOutBusy(true)
    try {
      await signOut()
    } finally {
      setSignOutBusy(false)
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 h-[60px] border-b border-border bg-white",
        className,
      )}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-navy text-sm font-bold text-white">
              G
            </span>
            <span className="text-lg font-semibold text-brand-navy">{appName}</span>
          </Link>
          <nav className="flex min-w-0 items-center gap-3 sm:gap-5" aria-label="Main">
            <Link
              href="/features"
              className={cn(
                "shrink-0 text-sm font-medium transition-colors",
                pathname === "/features"
                  ? "border-b-2 border-brand-blue pb-0.5 text-brand-blue"
                  : "border-b-2 border-transparent pb-0.5 text-slate-600 hover:text-brand-blue",
              )}
            >
              Features
            </Link>
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  className={cn(
                    "shrink-0 text-sm font-medium transition-colors",
                    pathname === "/dashboard" || pathname.startsWith("/dashboard/")
                      ? "border-b-2 border-brand-blue pb-0.5 text-brand-blue"
                      : "border-b-2 border-transparent pb-0.5 text-slate-600 hover:text-brand-blue",
                  )}
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setReconcileLoading(true)
                    router.push("/reconcile")
                  }}
                  className={cn(
                    "inline-flex min-w-[5.5rem] shrink-0 cursor-pointer items-center justify-center gap-1.5 bg-transparent p-0 text-sm font-medium transition-colors",
                    pathname === "/reconcile" || pathname.startsWith("/reconcile/")
                      ? "border-b-2 border-brand-blue pb-0.5 text-brand-blue"
                      : "border-b-2 border-transparent pb-0.5 text-slate-600 hover:text-brand-blue",
                    reconcileLoading && "pointer-events-none opacity-60",
                  )}
                >
                  {reconcileLoading ? (
                    <span
                      className="inline-block h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden
                    />
                  ) : null}
                  {reconcileLoading ? "Loading..." : "Reconcile"}
                </button>
              </>
            ) : null}
          </nav>
        </div>

        {loading ? (
          <div className="h-9 min-w-[180px]" aria-hidden />
        ) : isAuthenticated ? (
          <div className="relative" ref={wrapRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-brand-navy font-mono text-sm font-medium text-white transition-opacity hover:opacity-90"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
            >
              {initials}
            </button>
            {menuOpen ? (
              <div
                className="absolute right-0 top-12 z-50 min-w-[220px] overflow-hidden rounded-xl border border-border bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
                role="menu"
              >
                <div className="bg-surface-2 px-4 py-3">
                  <p className="text-sm font-medium text-brand-navy">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</p>
                </div>
                <div className="h-px bg-border" />
                <div
                  className="flex cursor-default items-center justify-between px-4 py-2.5 text-sm text-brand-navy opacity-50"
                  role="menuitem"
                >
                  <span className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" aria-hidden />
                    My Reconciliations
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Coming soon
                  </span>
                </div>
                <div
                  className="flex cursor-default items-center justify-between px-4 py-2.5 text-sm text-brand-navy opacity-50"
                  role="menuitem"
                >
                  <span className="flex items-center gap-2">
                    <Settings className="h-4 w-4" aria-hidden />
                    Account Settings
                  </span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Coming soon
                  </span>
                </div>
                <div className="h-px bg-border" />
                <button
                  type="button"
                  disabled={signOutBusy}
                  onClick={() => void onSignOut()}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-risk-critical hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-70"
                  role="menuitem"
                >
                  {signOutBusy ? (
                    <span
                      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden
                    />
                  ) : (
                    <LogOut className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {signOutBusy ? "Signing out..." : "Sign Out"}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "border-brand-navy text-brand-navy",
              )}
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className={cn(
                buttonVariants({ size: "sm" }),
                "bg-brand-blue text-white hover:bg-brand-blue/90",
              )}
            >
              Sign Up
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
