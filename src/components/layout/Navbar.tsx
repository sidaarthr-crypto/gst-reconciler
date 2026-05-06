"use client"

import Link from "next/link"
import { LogOut } from "lucide-react"

import { BrandLogo } from "@/components/ui/BrandLogo"
import { useAuth } from "@/hooks/useAuth"

export function Navbar() {
  const { user, loading, signOut, initials } = useAuth()

  return (
    <header className="sticky top-0 z-50 w-full max-w-full overflow-hidden bg-white">
      <nav className="relative flex min-h-[64px] w-full items-center justify-between gap-2 overflow-hidden border-b border-slate-200 px-3 py-3 sm:px-6 lg:px-8">
        <div className="relative z-10 flex min-w-0 shrink-0 items-center gap-0">
          <BrandLogo size="md" linkToHome variant="dark" />
          {!loading && user ? (
            <Link
              href="/dashboard"
              className="ml-2 shrink-0 whitespace-nowrap rounded-full bg-[#1e4d7b] px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#185FA5] sm:ml-4 sm:px-4 sm:py-1.5 sm:text-sm"
            >
              Dashboard
            </Link>
          ) : null}
        </div>

        <div className="pointer-events-none absolute left-1/2 hidden max-w-[min(40%,14rem)] -translate-x-1/2 select-none md:flex md:items-center md:justify-center lg:max-w-[40%]">
          <p className="text-center text-sm font-medium italic tracking-tight text-slate-500">
            Where reconciliation meets recovery.
          </p>
        </div>

        {/* Desktop nav */}
        <div className="relative z-10 hidden min-h-11 items-center justify-end gap-2.5 md:flex">
          {loading ? (
            <div
              className="h-8 w-28 animate-pulse rounded-md bg-slate-200"
              aria-hidden
            />
          ) : user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1e4d7b]">
                  <span className="text-xs font-bold text-white">{initials}</span>
                </div>
                <span className="hidden max-w-[200px] truncate text-sm text-slate-700 lg:block">
                  {user.email}
                </span>
              </div>
              <button
                type="button"
                className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[14px] font-semibold text-[#0F1C2E] transition-all duration-150 hover:border-slate-400"
                onClick={() => void signOut()}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <>
              <Link href="/auth/login">
                <button
                  type="button"
                  className="min-h-11 rounded-lg border border-slate-200 bg-white px-5 py-2 text-[14px] font-semibold text-[#0F1C2E] transition-all duration-150 hover:border-slate-400"
                >
                  Sign In
                </button>
              </Link>
              <Link href="/auth/register">
                <button
                  type="button"
                  className="min-h-11 rounded-lg bg-[#1447E6] px-5 py-2 text-[14px] font-semibold text-white transition-all duration-150 hover:bg-[#0F3DD4]"
                >
                  Sign Up
                </button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile: compact auth (logged out) or avatar + sign out (logged in) */}
        <div className="relative z-10 flex shrink-0 items-center gap-1.5 md:hidden">
          {loading ? (
            <div className="h-8 w-20 shrink-0 animate-pulse rounded-md bg-slate-200" aria-hidden />
          ) : user ? (
            <>
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1e4d7b]"
                title={user.email ?? undefined}
              >
                <span className="text-xs font-bold text-white">{initials}</span>
              </div>
              <button
                type="button"
                className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-[#0F1C2E] transition-all duration-150 hover:border-slate-400"
                aria-label="Sign Out"
                onClick={() => void signOut()}
              >
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="shrink-0">
                <button
                  type="button"
                  className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-[#0F1C2E] transition-all duration-150 hover:border-slate-400 sm:px-2.5 sm:text-sm"
                >
                  Sign In
                </button>
              </Link>
              <Link href="/auth/register" className="shrink-0">
                <button
                  type="button"
                  className="min-h-9 rounded-lg bg-[#1447E6] px-2 py-1.5 text-xs font-semibold text-white transition-all duration-150 hover:bg-[#0F3DD4] sm:px-2.5 sm:text-sm"
                >
                  Sign Up
                </button>
              </Link>
            </>
          )}
        </div>

      </nav>
    </header>
  )
}
