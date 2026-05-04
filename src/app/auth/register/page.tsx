"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, Check, Eye, EyeOff, X } from "lucide-react"

import { GoogleIcon } from "@/components/auth/GoogleIcon"
import { authCardClass, authInputClass } from "@/components/auth/auth-styles"
import { BrandLogo } from "@/components/ui/BrandLogo"
import { buttonVariants } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { mapAuthErrorMessage } from "@/lib/auth-errors"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { cn } from "@/lib/utils"

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "GSTRecon"

const spinSolid = (
  <span
    className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent"
    aria-hidden
  />
)

const spinOutline = (
  <span
    className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
    aria-hidden
  />
)

function passwordStrength(pw: string): "weak" | "fair" | "strong" {
  if (pw.length < 6) return "weak"
  const hasUpper = /[A-Z]/.test(pw)
  const hasNum = /\d/.test(pw)
  if (pw.length >= 8 && hasUpper && hasNum) return "strong"
  return "fair"
}

function passwordRules(pw: string) {
  return {
    len8: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    num: /\d/.test(pw),
  }
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [step, setStep] = useState<"form" | "success">("form")
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  const strength = passwordStrength(password)
  const rules = passwordRules(password)
  const confirmTouched = confirm.length > 0 && password.length > 0
  const mismatch = confirmTouched && password !== confirm
  const canSubmit =
    strength === "strong" && !mismatch && fullName.trim().length > 0 && email.includes("@")

  const formBusy = loading || googleLoading

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => window.clearInterval(t)
  }, [cooldown])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (!canSubmit) {
      setError(
        "Please use a strong password (8+ characters with uppercase and number) and ensure passwords match.",
      )
      return
    }
    setError(null)
    setLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const origin = window.location.origin
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${origin}/auth/callback`,
        },
      })
      if (err) {
        setError(mapAuthErrorMessage(err.message))
        return
      }
      setStep("success")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function onGoogle() {
    setError(null)
    setGoogleLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const origin = window.location.origin
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${origin}/auth/callback` },
      })
      if (err) {
        setError(err.message)
        setGoogleLoading(false)
      }
    } catch {
      setError("Could not start Google sign-in.")
      setGoogleLoading(false)
    }
  }

  async function onResend() {
    if (cooldown > 0 || resending) return
    setResending(true)
    setResendMsg(null)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error: err } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (err) {
        setResendMsg(err.message)
        return
      }
      setResendMsg("green:Email sent! Check your inbox.")
      setCooldown(30)
      window.setTimeout(() => setResendMsg(null), 2000)
    } catch {
      setResendMsg("Could not resend email.")
    } finally {
      setResending(false)
    }
  }

  const barColor = (i: number) => {
    if (strength === "weak") return i === 0 ? "bg-red-500" : "bg-muted"
    if (strength === "fair") return i <= 2 ? "bg-amber-500" : "bg-muted"
    return "bg-emerald-500"
  }

  const strengthLabel =
    strength === "weak" ? "Weak" : strength === "fair" ? "Fair" : "Strong"

  if (step === "success") {
    return (
      <>
        <div className={authCardClass}>
          <div className="mb-8 flex justify-center">
            <BrandLogo size="lg" linkToHome variant="dark" />
          </div>
          <div className="gst-check-pop mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500">
            <Check className="h-10 w-10 text-white" strokeWidth={3} aria-hidden />
          </div>
          <h1 className="mt-6 text-center text-2xl font-bold text-brand-navy">
            Check your email! 📬
          </h1>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            We sent a confirmation link to{" "}
            <span className="font-mono font-semibold text-brand-navy">{email}</span>
          </p>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Click the link to activate your account and start reconciling.
          </p>
          <div className="mt-6 rounded-lg bg-brand-blue-lt px-4 py-3 text-sm text-brand-navy">
            💡 Can&apos;t find the email? Check your spam folder or promotions tab.
          </div>
          {resendMsg?.startsWith("green:") ? (
            <p className="mt-4 text-center text-sm font-medium text-emerald-700">
              {resendMsg.replace("green:", "")}
            </p>
          ) : resendMsg ? (
            <p className="mt-4 text-center text-sm text-red-700">{resendMsg}</p>
          ) : null}
          <button
            type="button"
            disabled={resending || cooldown > 0}
            onClick={() => void onResend()}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "mt-4 flex h-11 min-w-[220px] w-full items-center justify-center gap-2",
              "disabled:pointer-events-none disabled:cursor-not-allowed",
              resending && "opacity-70",
              cooldown > 0 && !resending && "opacity-50",
            )}
          >
            {resending ? (
              <>
                {spinOutline}
                Sending...
              </>
            ) : cooldown > 0 ? (
              `Resend in ${cooldown}s...`
            ) : (
              "Resend confirmation email"
            )}
          </button>
          <p className="mt-6 text-center">
            <Link href="/auth/login" className="text-sm font-medium text-brand-blue hover:underline">
              ← Back to Sign In
            </Link>
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <div className={authCardClass}>
        <div className="mb-8 flex justify-center">
          <BrandLogo size="lg" linkToHome variant="dark" />
        </div>
        <h1 className="text-2xl font-bold text-brand-navy">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Free forever. No credit card required.</p>

        <form className="mt-6 space-y-5" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <input
              id="name"
              name="name"
              required
              placeholder="CA Ramesh Kumar"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={formBusy}
              className={cn(authInputClass, formBusy && "cursor-not-allowed opacity-70")}
            />
          </div>

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
              disabled={formBusy}
              className={cn(authInputClass, formBusy && "cursor-not-allowed opacity-70")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPw ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={formBusy}
                className={cn(
                  authInputClass,
                  "pr-10",
                  formBusy && "cursor-not-allowed opacity-70",
                )}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw((s) => !s)}
                disabled={formBusy}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex gap-1 pt-1">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={cn("h-1 flex-1 rounded-full", barColor(i))} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Strength: <span className="font-medium text-brand-navy">{strengthLabel}</span>
            </p>
            <ul className="space-y-1 text-xs">
              <li className={cn("flex items-center gap-2", rules.len8 ? "text-emerald-700" : "text-muted-foreground")}>
                {rules.len8 ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                At least 8 characters
              </li>
              <li className={cn("flex items-center gap-2", rules.upper ? "text-emerald-700" : "text-muted-foreground")}>
                {rules.upper ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                One uppercase letter
              </li>
              <li className={cn("flex items-center gap-2", rules.num ? "text-emerald-700" : "text-muted-foreground")}>
                {rules.num ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                One number
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <div className="relative">
              <input
                id="confirm"
                name="confirm"
                type={showPw2 ? "text" : "password"}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                disabled={formBusy}
                className={cn(
                  authInputClass,
                  "pr-10",
                  mismatch && "border-red-400",
                  formBusy && "cursor-not-allowed opacity-70",
                )}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPw2((s) => !s)}
                disabled={formBusy}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
                aria-label={showPw2 ? "Hide password" : "Show password"}
              >
                {showPw2 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {mismatch ? <p className="text-xs text-red-600">Passwords do not match</p> : null}
          </div>

          {error ? (
            <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit || loading || googleLoading}
            className={cn(
              buttonVariants({ size: "lg" }),
              "flex h-11 min-w-[220px] w-full items-center justify-center gap-2 bg-brand-blue text-white hover:bg-brand-blue/90",
              "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70",
            )}
          >
            {loading ? (
              <>
                {spinSolid}
                Creating your account...
              </>
            ) : (
              "Create Account"
            )}
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <button
            type="button"
            disabled={googleLoading || loading}
            onClick={() => void onGoogle()}
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "flex h-11 min-w-[220px] w-full items-center justify-center gap-2",
              "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70",
            )}
          >
            {googleLoading ? (
              <>
                {spinOutline}
                Connecting to Google...
              </>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>
        </form>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          By signing up you agree to our Terms of Service and Privacy Policy
        </p>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-medium text-brand-blue hover:underline">
            Sign in →
          </Link>
        </p>
      </div>
    </>
  )
}
