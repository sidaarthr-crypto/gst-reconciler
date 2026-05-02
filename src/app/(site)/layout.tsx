import { Footer } from "@/components/layout/Footer"
import { Navbar } from "@/components/layout/Navbar"

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-dm text-[15px]">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
