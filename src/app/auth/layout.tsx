export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dot-grid-bg pt-20 pb-16">
      <div className="mx-auto max-w-lg px-4">{children}</div>
    </div>
  )
}
