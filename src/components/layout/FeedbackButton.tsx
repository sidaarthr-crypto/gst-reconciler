"use client"

import { useMemo, useState } from "react"
import { Loader2, MessageSquare } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type FeedbackPayload = {
  name: string
  email: string
  message: string
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0
}

export function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)

  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 0 && email.trim().length > 0 && message.trim().length > 0
    )
  }, [name, email, message])

  const fieldClass = cn(
    "flex w-full rounded-lg border border-input bg-white px-3 text-sm shadow-sm outline-none transition",
    "placeholder:text-muted-foreground focus-visible:border-brand-blue focus-visible:ring-2 focus-visible:ring-brand-blue/25",
    "disabled:cursor-not-allowed disabled:opacity-50",
  )

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    if (!canSubmit) {
      toast.error("Please fill in all fields.")
      return
    }

    setLoading(true)
    try {
      const payload: FeedbackPayload = {
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
      }

      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data: unknown = await res
        .json()
        .catch(() => ({ error: "Invalid server response" }) as unknown)

      if (!res.ok) {
        const msg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          isNonEmptyString((data as { error?: unknown }).error)
            ? (data as { error: string }).error
            : "Could not send feedback."
        toast.error(msg)
        setLoading(false)
        return
      }

      toast.success("Thanks! Your feedback has been sent.")
      setOpen(false)
      setName("")
      setEmail("")
      setMessage("")
      setLoading(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send feedback.")
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "rounded-full px-4 py-2.5",
          "bg-[#1a3a5c] text-white",
          "shadow-lg hover:shadow-xl",
          "border border-white/10",
          "transition-all duration-200",
          "hover:bg-[#244a73] hover:scale-105",
          "gap-0 md:gap-2",
        )}
      >
        <MessageSquare size={16} aria-hidden />
        <span className="hidden md:inline">Feedback</span>
      </Button>

      <Dialog open={open} onOpenChange={(v) => (loading ? null : setOpen(v))}>
        <DialogContent className="max-w-[520px] p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Share Feedback</h2>
            <p className="text-sm text-muted-foreground">Help us improve GSTRecon</p>
          </div>

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="fb-name">
                Name
              </label>
              <input
                id="fb-name"
                name="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className={cn(fieldClass, "h-11")}
                placeholder="Your name"
              />
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="fb-email"
              >
                Email
              </label>
              <input
                id="fb-email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className={cn(fieldClass, "h-11")}
                placeholder="you@firm.com"
              />
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="fb-message"
              >
                Message
              </label>
              <textarea
                id="fb-message"
                name="message"
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={loading}
                className={cn(fieldClass, "min-h-[110px] resize-none py-2")}
                placeholder="Tell us what you liked, what’s confusing, or what you want next…"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                "Send Feedback"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

