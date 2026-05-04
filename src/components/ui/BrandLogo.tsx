import Link from "next/link"

import { cn } from "@/lib/utils"

interface BrandLogoProps {
  linkToHome?: boolean
  size?: "sm" | "md" | "lg"
  /** Light text for dark surfaces (e.g. navy navbar). Default: dark wordmark for light backgrounds. */
  variant?: "light" | "dark"
}

export function BrandLogo({ linkToHome = true, size = "md", variant = "dark" }: BrandLogoProps) {
  const sizes = {
    sm: { icon: { w: 20, h: 23 }, name: "text-[12px]", sub: "text-[7px]" },
    md: { icon: { w: 28, h: 32 }, name: "text-[15px]", sub: "text-[8px]" },
    lg: { icon: { w: 40, h: 46 }, name: "text-[20px]", sub: "text-[9px]" },
  }

  const s = sizes[size]

  const nameClass = variant === "light" ? "text-white" : "text-[#1a3a5c]"
  const subClass = variant === "light" ? "text-[#4fc3f7]" : "text-[#185FA5]"

  const content = (
    <div className="flex items-center gap-2.5">
      <svg
        width={s.icon.w}
        height={s.icon.h}
        viewBox="0 0 100 115"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M50 4 L96 23 L96 58 C96 86 75 107 50 115 C25 107 4 86 4 58 L4 23 Z"
          fill="#1a3a5c"
        />
        <path
          d="M50 13 L87 29 L87 58 C87 80 70 99 50 106 C30 99 13 80 13 58 L13 29 Z"
          fill="#1e4d7b"
        />
        <text
          x="50"
          y="78"
          textAnchor="middle"
          fontFamily="sans-serif"
          fontSize="54"
          fontWeight="700"
          fill="#4fc3f7"
        >
          ₹
        </text>
      </svg>
      <div className="flex flex-col leading-none gap-0.5">
        <span className={cn(s.name, "font-bold tracking-tight", nameClass)}>GSTRecon</span>
        <span className={cn(s.sub, "font-medium uppercase tracking-[0.15em]", subClass)}>
          GST Reconciliation
        </span>
      </div>
    </div>
  )

  if (linkToHome) {
    return (
      <Link href="/" aria-label="Go to GSTRecon home">
        {content}
      </Link>
    )
  }

  return content
}
