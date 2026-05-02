import type { Config } from "tailwindcss"

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-jakarta)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
        sora: ["Sora", "var(--font-sora)", "sans-serif"],
        dm: ["DM Sans", "var(--font-dm)", "sans-serif"],
      },
      colors: {
        brand: {
          navy: "#0F1629",
          slate: "#1E2A45",
          blue: "#2563EB",
          "blue-lt": "#EFF6FF",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          "2": "#F8FAFC",
          "3": "#F1F5F9",
        },
        border: {
          DEFAULT: "#E2E8F0",
          strong: "#CBD5E1",
        },
        risk: {
          critical: "#DC2626",
          "critical-bg": "#FEF2F2",
          high: "#EA580C",
          "high-bg": "#FFF7ED",
          medium: "#D97706",
          "medium-bg": "#FFFBEB",
          safe: "#16A34A",
          "safe-bg": "#F0FDF4",
        },
      },
    },
  },
} satisfies Config
