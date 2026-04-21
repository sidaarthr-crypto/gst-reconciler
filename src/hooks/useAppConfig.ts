"use client"

import { useEffect, useState } from "react"

import { getDefaultAppConfig, mapAppConfigRows } from "@/lib/config"
import type { AppConfig } from "@/lib/types"

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>(getDefaultAppConfig())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/config")
        const data = (await res.json()) as Record<string, unknown>
        if (!res.ok) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "Could not load configuration from the server.",
          )
        }
        const rows = Object.entries(data)
          .filter(([k]) => k !== "error")
          .map(([key, value]) => ({ key, value: String(value ?? "") }))
        if (!cancelled) {
          setConfig(mapAppConfigRows(rows))
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Could not load configuration from the server.",
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return { config, loading, error }
}
