import Script from "next/script"

export const UmamiAnalytics = () => {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
  if (!websiteId) return null

  return (
    <Script
      async
      src="https://umami-production-d720.up.railway.app/script.js"
      data-website-id={websiteId}
      strategy="afterInteractive"
    />
  )
}
