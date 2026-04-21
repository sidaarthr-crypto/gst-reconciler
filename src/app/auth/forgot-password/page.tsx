"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, Check } from "lucide-react"

import { authCardClass, authInputClass } from "@/components/auth/auth-styles"
import { buttonVariants } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { cn } from "@/lib/utils"

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "GSTRecon"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [resendBusy, setResendBusy] = useState(false)
  const [resendMsg, setResendMsg] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => window.clearInterval(t)
  }, [cooldown])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const origin = window.location.origin
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/reset-password`,
      })
      if (err) {
        setError(err.message)
        return
      }
      setDone(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function onResend() {
    if (cooldown > 0 || resendBusy) return
    setResendBusy(true)
    setResendMsg(null)
    try {
      const supabase = getSupabaseBrowserClient()
      const origin = window.location.origin
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/reset-password`,
      })
      if (err) {
        setResendMsg(err.message)
        return
      }
      setResendMsg("green:Reset link sent again.")
      setCooldown(30)
      window.setTimeout(() => setResendMsg(null), 3000)
    } catch {
      setResendMsg("Could not resend.")
    } finally {
      setResendBusy(false)
    }
  }

  return (
    <>
      <div className="mb-8 flex justify-center">
        <Link href="/" className="flex items-center gap-2 text-brand-navy">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-navy text-sm font-bold text-white">
            G
          </span>
          <span className="text-lg font-semibold">{appName}</span>
        </Link>
      </div>

      <div className={authCardClass}>
        {!done ? (
          <>
            <h1 className="text-2xl font-bold text-brand-navy">Reset your password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a reset link
            </p>
            <form className="mt-6 space-y-6" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="you@firm.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={authInputClass}
                />
              </div>
              {error ? (
                <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "h-11 w-full bg-brand-blue text-white hover:bg-brand-blue/90",
                  "inline-flex items-center justify-center gap-2 disabled:pointer-events-none disabled:opacity-70",
                )}
              >
                {loading ? (
                  <>
                    <span
                      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                      aria-hidden
                    />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="gst-check-pop mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500">
              <Check className="h-10 w-10 text-white" strokeWidth={3} aria-hidden />
            </div>
            <h1 className="mt-6 text-center text-2xl font-bold text-brand-navy">Reset link sent!</h1>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Check <span className="font-mono font-semibold text-brand-navy">{email}</span> for a
              password reset link. It expires in 1 hour.
            </p>
            {resendMsg?.startsWith("green:") ? (
              <p className="mt-4 text-center text-sm font-medium text-emerald-700">
                {resendMsg.replace("green:", "")}
              </p>
            ) : resendMsg ? (
              <p className="mt-4 text-center text-sm text-red-700">{resendMsg}</p>
            ) : null}
            <button
              type="button"
              disabled={resendBusy || cooldown > 0}
              onClick={() => void onResend()}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "mt-6 h-11 w-full disabled:pointer-events-none disabled:opacity-70",
              )}
            >
              {resendBusy ? (
                <>
                  <span
                    className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                    aria-hidden
                  />
                  Sending...
                </>
              ) : cooldown > 0 ? (
                `Resend in ${cooldown}s...`
              ) : (
                "Resend reset link"
              )}
            </button>
          </>
        )}
        <p className="mt-8 text-center">
          <Link href="/auth/login" className="text-sm font-medium text-brand-blue hover:underline">
            ← Back to Sign In
          </Link>
        </p>
      </div>
    </>
  )
}
