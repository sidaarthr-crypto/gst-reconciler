import { NextRequest, NextResponse } from "next/server"

import { Resend } from "resend"
import type { SupabaseClient } from "@supabase/supabase-js"

import { createServerSupabase } from "@/lib/supabase-server"

type FeedbackBody = {
  name: string
  email: string
  message: string
}

type FeedbackDatabase = {
  public: {
    Tables: {
      feedback: {
        Row: {
          id: string
          name: string
          email: string
          message: string
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          email: string
          message: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          message?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function emailHtml(params: {
  name: string
  email: string
  message: string
  timestamp: string
}): string {
  const name = escapeHtml(params.name)
  const email = escapeHtml(params.email)
  const message = escapeHtml(params.message).replaceAll("\n", "<br />")
  const timestamp = escapeHtml(params.timestamp)

  return `<!doctype html>
<html>
  <body style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #0f172a;">
    <div style="max-width: 560px; margin: 0 auto; padding: 24px;">
      <h2 style="margin: 0 0 12px; font-size: 18px;">New Feedback - GSTRecon</h2>
      <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
        <p style="margin: 0 0 10px;"><strong>Name:</strong> ${name}</p>
        <p style="margin: 0 0 10px;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 0 0 10px;"><strong>Timestamp:</strong> ${timestamp}</p>
        <div style="margin-top: 14px;">
          <p style="margin: 0 0 6px;"><strong>Message:</strong></p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px;">
            ${message}
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`
}

export async function POST(req: NextRequest) {
  try {
    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 },
      )
    }

    const body = raw as Partial<FeedbackBody>
    if (
      !isNonEmptyString(body.name) ||
      !isNonEmptyString(body.email) ||
      !isNonEmptyString(body.message)
    ) {
      return NextResponse.json(
        { error: "Missing required fields: name, email, message" },
        { status: 400 },
      )
    }

    const name = body.name.trim()
    const email = body.email.trim()
    const message = body.message.trim()
    const timestamp = new Date().toISOString()

    const insertPromise = (async () => {
      const supabase = (await createServerSupabase()) as unknown as SupabaseClient<FeedbackDatabase>
      const { error } = await supabase.from("feedback").insert({
        name,
        email,
        message,
      })
      if (error) throw new Error(error.message)
    })()

    const emailPromise = (async () => {
      const apiKey = process.env.RESEND_API_KEY
      const fromEmail = process.env.RESEND_FROM_EMAIL
      if (!apiKey || !fromEmail) {
        throw new Error("Missing RESEND_API_KEY or RESEND_FROM_EMAIL")
      }
      const resend = new Resend(apiKey)
      await resend.emails.send({
        from: fromEmail,
        to: "sidaarth.r@gmail.com",
        subject: "New Feedback - GSTRecon",
        html: emailHtml({ name, email, message, timestamp }),
      })
    })()

    const [insertResult, emailResult] = await Promise.allSettled([
      insertPromise,
      emailPromise,
    ])

    if (insertResult.status === "rejected") {
      return NextResponse.json(
        {
          error:
            insertResult.reason instanceof Error
              ? insertResult.reason.message
              : "Failed to save feedback",
        },
        { status: 500 },
      )
    }

    const emailSent = emailResult.status === "fulfilled"
    const emailError =
      emailResult.status === "rejected"
        ? emailResult.reason instanceof Error
          ? emailResult.reason.message
          : "Failed to send email"
        : null

    return NextResponse.json({
      ok: true,
      emailSent,
      emailError,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 },
    )
  }
}

