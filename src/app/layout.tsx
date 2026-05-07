import type { Metadata } from "next"
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google"
import { ThemeProvider } from "next-themes"

import { UmamiAnalytics } from "@/components/UmamiAnalytics"
import { FeedbackButton } from "@/components/layout/FeedbackButton"
import { AuthProvider } from "@/hooks/useAuth"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

import "./globals.css"

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
})

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "GSTRecon — GST Reconciliation for CAs",
  description:
    "Reconcile GSTR-2B with your Purchase Register. 28 diagnostic checks per invoice. Built for CA firms.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "GSTRecon — GST Reconciliation for CAs",
    description:
      "Reconcile GSTR-2B with your Purchase Register. 28 diagnostic checks per invoice. Built for CA firms.",
  },
  twitter: {
    card: "summary_large_image",
    title: "GSTRecon — GST Reconciliation for CAs",
    description:
      "Reconcile GSTR-2B with your Purchase Register. 28 diagnostic checks per invoice. Built for CA firms.",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <TooltipProvider delay={200}>
            <AuthProvider>
              {children}
            </AuthProvider>
            <Toaster richColors position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
        <UmamiAnalytics />
        <FeedbackButton />
      </body>
    </html>
  )
}
