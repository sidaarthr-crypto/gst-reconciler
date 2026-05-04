"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, Check, Eye, EyeOff } from "lucide-react"

import { authCardClass, authInputClass } from "@/components/auth/auth-styles"
import { BrandLogo } from "@/components/ui/BrandLogo"
import { buttonVariants } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { cn } from "@/lib/utils"

function passwordRules(pw: string) {
  return {
    len8: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    num: /\d/.test(pw),
  }
}

function isStrong(pw: string) {
  const r = passwordRules(pw)
  return r.len8 && r.upper && r.num
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError("Invalid or expired reset link. Request a new password reset from sign in.")
      }
    })
  }, [])

  const rules = passwordRules(password)
  const mismatch = confirm.length > 0 && password.length > 0 && password !== confirm
  const canSubmit = isStrong(password) && !mismatch

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) {
        setError(err.message)
        return
      }
      setSuccess(true)
      window.setTimeout(() => router.push("/auth/login"), 2000)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className={authCardClass}>
        <div className="mb-8 flex justify-center">
          <BrandLogo size="lg" linkToHome variant="dark" />
        </div>
        {!success ? (
          <>
            <h1 className="text-2xl font-bold text-brand-navy">Set new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a strong password for your account
            </p>
            <form className="mt-6 space-y-5" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={cn(authInputClass, "pr-10")}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li className={cn(rules.len8 && "text-emerald-700")}>
                    {rules.len8 ? "✓" : "×"} At least 8 characters
                  </li>
                  <li className={cn(rules.upper && "text-emerald-700")}>
                    {rules.upper ? "✓" : "×"} One uppercase letter
                  </li>
                  <li className={cn(rules.num && "text-emerald-700")}>
                    {rules.num ? "✓" : "×"} One number
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm new password</Label>
                <div className="relative">
                  <input
                    id="confirm"
                    type={showPw2 ? "text" : "password"}
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className={cn(authInputClass, "pr-10", mismatch && "border-red-400")}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPw2((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
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
                disabled={!canSubmit || loading}
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
                    Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="gst-check-pop mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500">
              <Check className="h-10 w-10 text-white" strokeWidth={3} aria-hidden />
            </div>
            <h1 className="mt-6 text-2xl font-bold text-brand-navy">Password updated!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your password has been changed successfully.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">Redirecting to sign in…</p>
          </div>
        )}
      </div>
    </>
  )
}
