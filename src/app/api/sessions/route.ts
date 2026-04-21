import { NextRequest, NextResponse } from "next/server"

import { createServerSupabase } from "@/lib/supabase-server"

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      month: number
      year: number
      gstr2bFilename: string
      gstr2bRowCount: number
      prFilename: string
      prRowCount: number
      requestId: string
      clientGstin?: string | null
      clientName?: string | null
    }

    const forwarded = req.headers.get("x-forwarded-for")
    const ip =
      forwarded?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null

    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from("reconciliation_sessions")
      .insert({
        request_id: body.requestId,
        status: "processing",
        reconciliation_period_month: body.month,
        reconciliation_period_year: body.year,
        gstr2b_filename: body.gstr2bFilename,
        gstr2b_row_count: body.gstr2bRowCount,
        pr_filename: body.prFilename,
        pr_row_count: body.prRowCount,
        client_gstin: body.clientGstin?.trim() || null,
        client_name: body.clientName?.trim() || null,
        ip_address: ip,
        user_agent: req.headers.get("user-agent"),
        user_id: user?.id ?? null,
        is_guest: !user,
      })
      .select("id")
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      sessionId: data.id,
      requestId: body.requestId,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    )
  }
}
