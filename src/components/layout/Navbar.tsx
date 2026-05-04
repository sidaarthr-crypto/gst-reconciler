"use client"

import Link from "next/link"

import { BrandLogo } from "@/components/ui/BrandLogo"
import { useAuth } from "@/hooks/useAuth"

export function Navbar() {
  const { user, loading, signOut, initials } = useAuth()

  return (
    <header className="sticky top-0 z-50 w-full bg-white">
      <nav className="relative flex h-[64px] w-full items-center justify-between border-b border-slate-200 px-10">
        <div className="relative z-10 flex min-w-0 flex-shrink-0 items-center gap-0">
          <BrandLogo size="md" linkToHome variant="dark" />
          {!loading && user ? (
            <Link
              href="/dashboard"
              className="ml-4 whitespace-nowrap rounded-full bg-[#1e4d7b] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#185FA5]"
            >
              Dashboard
            </Link>
          ) : null}
        </div>

        <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2 select-none">
          <span className="text-[13px] font-medium italic tracking-tight text-slate-400">
            Where reconciliation meets recovery.
          </span>
        </div>

        <div className="relative z-10 flex min-h-[40px] items-center justify-end gap-2.5">
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
                <span className="hidden max-w-[200px] truncate text-sm text-slate-700 md:block">
                  {user.email}
                </span>
              </div>
              <button
                type="button"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[14px] font-semibold text-[#0F1C2E] transition-all duration-150 hover:border-slate-400"
                onClick={() => void signOut()}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <>
              <Link href="/auth/login">
                <button
                  className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-[14px] font-semibold text-[#0F1C2E] transition-all duration-150 hover:border-slate-400"
                  type="button"
                >
                  Sign In
                </button>
              </Link>
              <Link href="/auth/register">
                <button
                  className="rounded-lg bg-[#1447E6] px-5 py-2 text-[14px] font-semibold text-white transition-all duration-150 hover:bg-[#0F3DD4]"
                  type="button"
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
