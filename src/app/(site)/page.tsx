"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { CTABanner } from "@/components/landing/CTABanner"
import { Features } from "@/components/landing/Features"
import { Hero } from "@/components/landing/Hero"
import { HowItWorks } from "@/components/landing/HowItWorks"
import { TrustBar } from "@/components/landing/TrustBar"
import { useAuth } from "@/hooks/useAuth"

export default function HomePage() {
  const { loading, isAuthenticated } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.replace("/dashboard")
    }
  }, [loading, isAuthenticated, router])

  if (loading || isAuthenticated) {
    return (
      <div className="flex min-h-[calc(100vh-120px)] flex-col items-center justify-center px-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-brand-blue border-t-transparent"
          aria-hidden
        />
        <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <>
      <Hero />
      <TrustBar />
      <Features />
      <HowItWorks />
      <CTABanner />
    </>
  )
}
