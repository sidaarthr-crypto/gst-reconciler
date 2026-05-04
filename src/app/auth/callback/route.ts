import { NextResponse } from "next/server"

import { createServerSupabase } from "@/lib/supabase-server"

/**
 * OAuth / email confirmation callback.
 * Uses @supabase/ssr (recommended for App Router; replaces deprecated auth-helpers).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next") ?? "/dashboard"

  if (code) {
    const supabase = await createServerSupabase()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
