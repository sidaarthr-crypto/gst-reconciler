import type { NextConfig } from "next";

// Next 16 dev sets `TURBOPACK=auto` by default. That enables Turbopack PostCSS, which can
// throw `SyntaxError: Unexpected token '??='` on older Node. Only strip the default in
// development so `next dev --turbopack` (`TURBOPACK` not `auto`) and `next build` are unchanged.
if (
  process.env.NODE_ENV === "development" &&
  process.env.TURBOPACK === "auto"
) {
  delete process.env.TURBOPACK;
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
