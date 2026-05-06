"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react"

import { GoogleIcon } from "@/components/auth/GoogleIcon"
import { authCardClass, authInputClass } from "@/components/auth/auth-styles"
import { BrandLogo } from "@/components/ui/BrandLogo"
import { buttonVariants } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { mapAuthErrorMessage } from "@/lib/auth-errors"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { cn } from "@/lib/utils"

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "GSTRecon"
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")

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

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const formBusy = loading || googleLoading

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) {
        setError(mapAuthErrorMessage(err.message))
        setLoading(false)
        return
      }
      setSuccess(true)
      window.setTimeout(() => router.push("/dashboard"), 1000)
    } catch {
      setError("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  async function onGoogle() {
    setError(null)
    setGoogleLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${siteUrl}/auth/callback` },
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

  return (
    <>
      <div className={authCardClass}>
        <div className="mb-8 flex justify-center">
          <BrandLogo size="lg" linkToHome variant="dark" />
        </div>
        <h1 className="text-2xl font-bold text-brand-navy">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to your {appName} account
        </p>

        <form className="mt-6 space-y-6" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@firm.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={formBusy}
              className={cn(authInputClass, formBusy && "cursor-not-allowed opacity-70")}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/auth/forgot-password"
                className="text-xs font-medium text-brand-blue hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
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
          </div>

          {error ? (
            <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          ) : null}

          {success ? (
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
              Signed in! Redirecting...
            </div>
          ) : (
            <button
              type="submit"
              disabled={loading || googleLoading}
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-11 min-w-[220px] w-full bg-brand-blue text-white hover:bg-brand-blue/90",
                "inline-flex items-center justify-center gap-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70",
              )}
            >
              {loading ? (
                <>
                  {spinSolid}
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          )}

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
              "h-11 min-w-[220px] w-full border-input",
              "inline-flex items-center justify-center gap-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-70",
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

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="font-medium text-brand-blue hover:underline">
            Sign up free →
          </Link>
        </p>
      </div>
    </>
  )
}
