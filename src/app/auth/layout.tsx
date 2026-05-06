import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-[#F8FAFC] dot-grid-bg pb-16 pt-12 md:pt-20">
      <div className="mx-auto w-full max-w-md px-4 sm:px-6">{children}</div>
    </div>
  )
}
