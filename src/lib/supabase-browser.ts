"use client"

import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/lib/database.types"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

export function getSupabaseBrowserClient() {
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    )
  }
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(url, key)
  }
  return browserClient
}
