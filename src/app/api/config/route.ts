import { NextResponse } from "next/server"

import { supabase } from "@/lib/supabase"

export async function GET() {
  try {
    const { data, error } = await supabase.from("app_config").select("key, value")
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      )
    }
    const payload: Record<string, string> = {}
    for (const row of data ?? []) {
      payload[row.key] = row.value
    }
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    )
  }
}
