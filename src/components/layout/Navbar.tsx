"use client"

import Link from "next/link"

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full bg-white">
      <nav className="relative flex h-[64px] w-full items-center justify-between border-b border-slate-200 px-10">
        <Link href="/" className="group relative z-10 flex flex-shrink-0 items-center gap-2.5">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] bg-[#0F1C2E]">
            <svg
              width="18"
              height="18"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
              className="transition-transform duration-200 group-hover:rotate-[-8deg] group-hover:scale-105"
            >
              <path d="M7 1L12 3.9V10.1L7 13L2 10.1V3.9L7 1Z" fill="#3B82F6" />
              <path d="M7 4.5L9.5 5.9V8.7L7 10L4.5 8.7V5.9L7 4.5Z" fill="white" opacity="0.9" />
            </svg>
          </span>
          <span className="font-sora ml-2.5 text-[17px] font-extrabold tracking-tight text-[#0F1C2E]">
            GST Shield
          </span>
        </Link>

        <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2 select-none">
          <span className="text-[13px] font-medium italic tracking-tight text-slate-400">
            Where reconciliation meets recovery.
          </span>
        </div>

        <div className="relative z-10 flex items-center gap-2.5">
          <a href="/auth/login">
            <button
              className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-[14px] font-semibold text-[#0F1C2E] transition-all duration-150 hover:border-slate-400"
              type="button"
            >
              Sign In
            </button>
          </a>
          <a href="/auth/register">
            <button
              className="rounded-lg bg-[#1447E6] px-5 py-2 text-[14px] font-semibold text-white transition-all duration-150 hover:bg-[#0F3DD4]"
              type="button"
            >
              Sign Up
            </button>
          </a>
        </div>
      </nav>
    </header>
  )
}
