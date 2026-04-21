"use client"

import { startTransition, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { BarChart3, LogOut, Menu, Settings, X } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "GSTRecon"

export function Navbar({ className }: { className?: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const { loading, isAuthenticated, signOut, displayName, initials, user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [signOutBusy, setSignOutBusy] = useState(false)
  const [reconcileLoading, setReconcileLoading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const mobileWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    startTransition(() => {
      setMenuOpen(false)
      setMobileNavOpen(false)
    })
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

  useEffect(() => {
    if (!mobileNavOpen) return
    function onDocMouseDown(e: MouseEvent) {
      if (mobileWrapRef.current && !mobileWrapRef.current.contains(e.target as Node)) {
        setMobileNavOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocMouseDown)
    return () => document.removeEventListener("mousedown", onDocMouseDown)
  }, [mobileNavOpen])

  async function onSignOut() {
    if (signOutBusy) return
    setSignOutBusy(true)
    try {
      await signOut()
    } finally {
      setSignOutBusy(false)
    }
  }

  function goReconcile() {
    setReconcileLoading(true)
    setMobileNavOpen(false)
    router.push("/reconcile")
  }

  const navLinkClass = (active: boolean) =>
    cn(
      "flex min-h-11 items-center text-sm font-medium transition-colors md:inline-flex md:min-h-0 md:shrink-0",
      active
        ? "border-brand-blue text-brand-blue md:border-b-2 md:pb-0.5"
        : "border-transparent text-slate-600 hover:text-brand-blue md:border-b-2 md:pb-0.5",
    )

  return (
    <header
      className={cn(
        "sticky top-0 z-50 h-[60px] border-b border-border bg-white",
        className,
      )}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-4 md:gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-navy text-sm font-bold text-white">
              G
            </span>
            <span className="text-lg font-semibold text-brand-navy">{appName}</span>
          </Link>

          <nav className="hidden min-w-0 items-center gap-3 md:flex md:gap-5" aria-label="Main">
            <Link href="/features" className={navLinkClass(pathname === "/features")}>
              Features
            </Link>
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  className={navLinkClass(
                    pathname === "/dashboard" || pathname.startsWith("/dashboard/"),
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
                    navLinkClass(
                      pathname === "/reconcile" || pathname.startsWith("/reconcile/"),
                    ),
                    "inline-flex min-w-[5.5rem] cursor-pointer items-center justify-center gap-1.5 bg-transparent p-0",
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

        <div className="flex shrink-0 items-center gap-2">
          {loading ? (
            <div className="h-9 min-w-[180px]" aria-hidden />
          ) : isAuthenticated ? (
            <>
              <div className="relative hidden md:block" ref={wrapRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-brand-navy font-mono text-sm font-medium text-white transition-opacity hover:opacity-90"
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
                      className="flex w-full min-h-11 items-center gap-2 px-4 py-2.5 text-left text-sm text-risk-critical hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-70"
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

              <div className="relative md:hidden" ref={mobileWrapRef}>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    className="flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-full bg-brand-navy font-mono text-sm font-medium text-white transition-opacity hover:opacity-90"
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    aria-label="Account menu"
                  >
                    {initials}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-11 min-w-11 items-center justify-center rounded-md text-brand-navy hover:bg-slate-100"
                    aria-expanded={mobileNavOpen}
                    aria-controls="mobile-main-nav"
                    aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
                    onClick={() => {
                      setMobileNavOpen((o) => !o)
                      setMenuOpen(false)
                    }}
                  >
                    {mobileNavOpen ? (
                      <X className="h-6 w-6 shrink-0" aria-hidden />
                    ) : (
                      <Menu className="h-6 w-6 shrink-0" aria-hidden />
                    )}
                  </button>
                </div>
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
                    <button
                      type="button"
                      disabled={signOutBusy}
                      onClick={() => void onSignOut()}
                      className="flex w-full min-h-11 items-center gap-2 px-4 py-2.5 text-left text-sm text-risk-critical hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-70"
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
                {mobileNavOpen ? (
                  <div
                    id="mobile-main-nav"
                    className="fixed inset-x-0 top-[60px] z-40 border-b border-border bg-white py-2 shadow-md md:hidden"
                    role="navigation"
                    aria-label="Mobile main"
                  >
                    <div className="mx-auto flex max-w-6xl flex-col px-4">
                      <Link
                        href="/features"
                        className="min-h-11 border-b border-border/60 px-1 py-3 text-sm font-medium text-brand-navy last:border-b-0 hover:text-brand-blue"
                        onClick={() => setMobileNavOpen(false)}
                      >
                        Features
                      </Link>
                      <Link
                        href="/dashboard"
                        className="min-h-11 border-b border-border/60 px-1 py-3 text-sm font-medium text-brand-navy last:border-b-0 hover:text-brand-blue"
                        onClick={() => setMobileNavOpen(false)}
                      >
                        Dashboard
                      </Link>
                      <button
                        type="button"
                        className="min-h-11 border-b border-border/60 px-1 py-3 text-left text-sm font-medium text-brand-navy hover:text-brand-blue disabled:opacity-60"
                        onClick={() => goReconcile()}
                        disabled={reconcileLoading}
                      >
                        {reconcileLoading ? "Opening…" : "Reconcile"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="hidden items-center gap-2 md:flex">
                <Link
                  href="/auth/login"
                  className={cn(
                    buttonVariants({ size: "sm", variant: "outline" }),
                    "min-h-10 border-brand-navy text-brand-navy",
                  )}
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/register"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "min-h-10 bg-brand-blue text-white hover:bg-brand-blue/90",
                  )}
                >
                  Sign Up
                </Link>
              </div>
              <div className="relative md:hidden" ref={mobileWrapRef}>
                <button
                  type="button"
                  className="inline-flex h-11 min-w-11 items-center justify-center rounded-md text-brand-navy hover:bg-slate-100"
                  aria-expanded={mobileNavOpen}
                  aria-controls="mobile-main-nav-guest"
                  aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
                  onClick={() => setMobileNavOpen((o) => !o)}
                >
                  {mobileNavOpen ? (
                    <X className="h-6 w-6 shrink-0" aria-hidden />
                  ) : (
                    <Menu className="h-6 w-6 shrink-0" aria-hidden />
                  )}
                </button>
                {mobileNavOpen ? (
                  <div
                    id="mobile-main-nav-guest"
                    className="fixed inset-x-0 top-[60px] z-40 border-b border-border bg-white py-2 shadow-md"
                    role="navigation"
                    aria-label="Mobile main"
                  >
                    <div className="mx-auto flex max-w-6xl flex-col px-4 pb-3 pt-1">
                      <Link
                        href="/features"
                        className="min-h-11 border-b border-border/60 px-1 py-3 text-sm font-medium text-brand-navy hover:text-brand-blue"
                        onClick={() => setMobileNavOpen(false)}
                      >
                        Features
                      </Link>
                      <div className="mt-4 flex flex-col gap-2">
                        <Link
                          href="/auth/login"
                          className={cn(
                            buttonVariants({ size: "default", variant: "outline" }),
                            "min-h-11 w-full justify-center border-brand-navy text-brand-navy",
                          )}
                          onClick={() => setMobileNavOpen(false)}
                        >
                          Sign In
                        </Link>
                        <Link
                          href="/auth/register"
                          className={cn(
                            buttonVariants({ size: "default" }),
                            "min-h-11 w-full justify-center bg-brand-blue text-white hover:bg-brand-blue/90",
                          )}
                          onClick={() => setMobileNavOpen(false)}
                        >
                          Sign Up
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
