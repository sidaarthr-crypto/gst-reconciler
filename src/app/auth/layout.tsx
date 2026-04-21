export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dot-grid-bg pb-16 pt-12 md:pt-20">
      <div className="mx-auto max-w-lg px-0 md:px-4">{children}</div>
    </div>
  )
}
