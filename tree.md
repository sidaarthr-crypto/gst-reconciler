# Project tree

Workspace root may be `gstmismatch/`; the application lives in **`gst-reconciler/`**.

Sections below list **each tracked source file** (or committed config), **this inventory doc**, and what each does. Omitted: `node_modules/`, `.next/`, gitignored TypeScript artifacts (`next-env.d.ts`, `*.tsbuildinfo`), and other local-only files (e.g. `.env.local`).

## Directory layout

```
gst-reconciler/
├── public/                 # Static assets (favicons, SVGs)
├── src/
│   ├── app/                # Next.js App Router: pages + API routes
│   ├── components/         # UI: landing, reconcile, dashboard, auth, shadcn ui/
│   ├── hooks/              # Client hooks (auth, config, reconciliation)
│   ├── lib/                # Types, Supabase, parser, reconcile engine, export
│   ├── styles/             # Tailwind/theme entry; consumed via app/globals.css
│   ├── supabase/           # SQL migrations + email setup notes
│   └── middleware.ts       # Auth cookie refresh; protects /dashboard
├── .env.example            # Template for NEXT_PUBLIC_* env vars
├── .gitignore
├── .nvmrc                  # Suggested Node version
├── AGENTS.md               # Notes for AI/agent tooling
├── CLAUDE.md               # Claude agent context
├── components.json         # shadcn/ui generator config
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── README.md
├── tailwind.config.ts
├── TREE.md                 # This file (`tree.md` on case-insensitive FS): layout and file roles
├── tsconfig.json
└── vercel.json             # Vercel: build + bom1 region
```

## Root config and docs

| File | Purpose |
|------|---------|
| `package.json` | Scripts (`dev` uses `next dev --webpack`, plus `build`, `start`, `lint`) and dependency manifest |
| `package-lock.json` | Exact locked versions for reproducible `npm install` |
| `.nvmrc` | Node version hint for nvm / fnm |
| `tsconfig.json` | TypeScript compiler options and path aliases |
| `next-env.d.ts` | Auto-generated Next.js ambient types (**gitignored**; recreated by `next dev` / `next build`) |
| `*.tsbuildinfo` | TypeScript incremental build cache (**gitignored**) |
| `next.config.ts` | Next.js configuration; in development, clears default `TURBOPACK=auto` so older Node avoids Turbopack PostCSS parse errors |
| `eslint.config.mjs` | ESLint 9 flat config for the repo |
| `postcss.config.mjs` | PostCSS plugins (Tailwind v4 pipeline) |
| `tailwind.config.ts` | Tailwind CSS theme and content paths |
| `components.json` | shadcn/ui CLI config (style, aliases, component paths) |
| `vercel.json` | Vercel framework, install/build commands, `bom1` region |
| `.gitignore` | Paths Git should ignore |
| `.env.example` | Example `NEXT_PUBLIC_*` keys for Supabase and app metadata |
| `.env.local` | Local overrides and secrets (not committed) |
| `README.md` | Setup, env, migrations, run, build, deploy |
| `TREE.md` | This document: tree and per-file descriptions (same path as `tree.md` on macOS default FS) |
| `AGENTS.md` | Conventions and notes for AI coding agents |
| `CLAUDE.md` | Same for Claude-specific workflows |

## `public/`

| File | Purpose |
|------|---------|
| `favicon.ico` | Classic favicon for browsers that prefer ICO |
| `favicon.svg` | Vector favicon for modern browsers |
| `next.svg` | Default Next.js logo asset (starter / optional use) |
| `vercel.svg` | Vercel logo asset (starter / optional use) |
| `globe.svg` | Generic globe illustration |
| `window.svg` | Generic window illustration |
| `file.svg` | Generic file illustration |

## `src/app/`

| File | Purpose |
|------|---------|
| `layout.tsx` | Root layout: metadata, fonts, `globals.css`, theme and auth providers, toasts, Umami |
| `globals.css` | Imports `src/styles/globals.css`; route-level animations and utility classes |
| `(site)/layout.tsx` | Wrapper for marketing pages (navbar, footer) |
| `(site)/page.tsx` | Landing / home page |
| `(site)/features/page.tsx` | Product features marketing page |
| `(site)/reconcile/page.tsx` | Main reconciliation workflow (upload, results, export) |
| `auth/layout.tsx` | Centered card layout and styling for all auth routes |
| `auth/login/page.tsx` | Email/password and Google sign-in |
| `auth/register/page.tsx` | New account registration |
| `auth/forgot-password/page.tsx` | Request password reset email |
| `auth/reset-password/page.tsx` | Set new password from recovery link |
| `auth/callback/route.ts` | Exchanges Supabase auth code for session; redirects after OAuth / magic link |
| `dashboard/layout.tsx` | Authenticated dashboard shell (nav, user menu) |
| `dashboard/page.tsx` | CA dashboard: KPIs, chart, filters, session tables |
| `dashboard/loading.tsx` | Suspense fallback while dashboard data loads |
| `dashboard/customers/[gstin]/page.tsx` | Drill-down for one customer GSTIN |
| `dashboard/customers/[gstin]/loading.tsx` | Loading UI for customer GSTIN route |
| `dashboard/requests/[requestId]/page.tsx` | Detail view for one reconciliation session |
| `dashboard/requests/[requestId]/loading.tsx` | Loading UI for request detail route |
| `api/config/route.ts` | GET public `app_config` rows (limits, feature flags) for the client |
| `api/dashboard/route.ts` | GET aggregated dashboard payload for the signed-in user |
| `api/sessions/route.ts` | POST create session; GET list sessions (with filters) |
| `api/sessions/[id]/route.ts` | GET/PATCH/DELETE a single session by id |
| `api/sessions/[id]/results/route.ts` | GET reconciliation results; POST bulk upsert results for a session |

## `src/components/ui/`

| File | Purpose |
|------|---------|
| `button.tsx` | Button primitive with variants (shadcn-style) |
| `card.tsx` | Card shell: header, content, footer slots |
| `badge.tsx` | Small status / label chip |
| `dialog.tsx` | Accessible modal dialog (overlay, focus trap) |
| `label.tsx` | Form field label |
| `select.tsx` | Styled select / dropdown |
| `separator.tsx` | Horizontal or vertical divider |
| `tooltip.tsx` | Hover / focus tooltip |
| `progress.tsx` | Progress bar for long operations |
| `sonner.tsx` | Toaster wrapper for Sonner toast library |

## `src/components/landing/`

| File | Purpose |
|------|---------|
| `Hero.tsx` | Above-the-fold headline, CTA, hero visuals on home |
| `Features.tsx` | Feature grid or list on landing |
| `HowItWorks.tsx` | Step-by-step explanation section |
| `TrustBar.tsx` | Trust signals (e.g. compliance, security hints) |
| `CTABanner.tsx` | Bottom or inline call-to-action strip |

## `src/components/layout/`

| File | Purpose |
|------|---------|
| `Navbar.tsx` | Top navigation, links, auth actions |
| `Footer.tsx` | Site footer links and copy |

## `src/components/auth/`

| File | Purpose |
|------|---------|
| `auth-styles.ts` | Shared class names / layout constants for auth screens |
| `GoogleIcon.tsx` | Inline Google “G” icon for OAuth button |

## `src/components/reconcile/`

| File | Purpose |
|------|---------|
| `FileUpload.tsx` | Drag-and-drop and file picker for GSTR-2B / PR files |
| `ProcessingState.tsx` | UI while parsing or reconciling runs |
| `GateModal.tsx` | Modal prompting sign-in or registration when guest hits limits |
| `GuestPromoBanner.tsx` | Banner nudging guests to create an account |
| `RequestIdBanner.tsx` | Shows public session / request id for sharing or support |
| `SummaryCards.tsx` | High-level KPI cards (counts, totals, risk summary) |
| `GSTR3BSummary.tsx` | Summary block styled for GSTR-3B–relevant ITC picture |
| `FilterBar.tsx` | Filters for supplier, status, risk, etc. on results |
| `ReconciliationTable.tsx` | Main tabular view of matched / unmatched invoices |
| `SupplierView.tsx` | Results grouped or focused by supplier |
| `InvoiceDetailModal.tsx` | Modal with per-invoice line detail |
| `ExportButton.tsx` | Triggers Excel export of current results |
| `StatusBadge.tsx` | Visual for reconciliation status (matched, pending, etc.) |
| `ActionBadge.tsx` | Suggested action for the row (accept, follow up, etc.) |
| `RiskBadge.tsx` | ITC risk level indicator |
| `EmptyState.tsx` | Placeholder when there is no data to show |
| `MonthPicker.tsx` | Select return period month/year for the run |

## `src/components/dashboard/`

| File | Purpose |
|------|---------|
| `CaDashboardKpis.tsx` | KPI tiles for the CA dashboard overview |
| `MonthlyChart.tsx` | Chart.js chart of activity or amounts by month |
| `FilterPanel.tsx` | Period and other filters for dashboard data |
| `SearchBar.tsx` | Text search over suppliers or sessions |
| `SupplierTable.tsx` | Table of suppliers / customers with aggregates |
| `RequestsTable.tsx` | Table of recent reconciliation sessions |
| `AllReconciliationRequestsTable.tsx` | Full-width list of all requests with pagination-style UX |
| `ReportModal.tsx` | Modal to preview or confirm report export |
| `DashboardSkeleton.tsx` | Skeleton loaders matching dashboard layout |

## `src/components/` (root)

| File | Purpose |
|------|---------|
| `UmamiAnalytics.tsx` | Injects Umami analytics script when `NEXT_PUBLIC_UMAMI_*` is set |

## `src/hooks/`

| File | Purpose |
|------|---------|
| `auth-context.tsx` | React context holding Supabase session and user |
| `useAuth.ts` | Hook: sign in/out, session, and profile helpers |
| `useAppConfig.ts` | Hook: loads and caches `/api/config` |
| `useReconciliation.ts` | Hook: parse files, run reconcile, save session, export |
| `useMediaQuery.ts` | Hook: CSS media query match for responsive UI |

## `src/lib/`

| File | Purpose |
|------|---------|
| `supabase.ts` | Singleton browser Supabase client; validates public env at load |
| `supabase-browser.ts` | Lazy singleton `getSupabaseBrowserClient()` using `@supabase/ssr` for client components |
| `supabase-server.ts` | Server Supabase client with cookie-based auth for RSC/API |
| `config.ts` | Typed helpers reading `NEXT_PUBLIC_*` and related env |
| `types.ts` | Core domain types (invoices, results, session shape) |
| `database.types.ts` | TypeScript types aligned with Supabase tables |
| `parser.ts` | Parses uploaded workbooks into normalized invoice rows |
| `header-match.ts` | Maps messy column headers to canonical fields |
| `file-validation.ts` | Validates file type, size, and basic structure before parse |
| `reconcile.ts` | GSTR-2B vs purchase register matching and ITC risk scoring |
| `gstin-state.ts` | Derives state from GSTIN prefix |
| `export.ts` | Builds downloadable Excel from reconciliation results |
| `guest-usage.ts` | Tracks guest reconciliation usage against configured limits |
| `sampleData.ts` | Static sample rows for demos or empty-state previews |
| `dashboard-types.ts` | TypeScript types for dashboard API payloads and rows |
| `dashboard-period.ts` | Parses and formats `?period=` query for dashboard month/year |
| `dashboard-dates.ts` | Formats ISO timestamps for dashboard display |
| `analytics.ts` | Thin helpers for firing analytics events (e.g. Umami) |
| `auth-errors.ts` | Maps Supabase auth errors to user-readable messages |
| `utils.ts` | Shared helpers (e.g. `cn` for merging Tailwind classes) |

## `src/styles/`

| File | Purpose |
|------|---------|
| `globals.css` | Tailwind v4 entry (`@import "tailwindcss"`), theme tokens, shadcn styles; imported by `src/app/globals.css` |

## `src/middleware.ts`

| File | Purpose |
|------|---------|
| `middleware.ts` | Refreshes Supabase auth cookies on each request; redirects unauthenticated users away from `/dashboard` |

## `src/supabase/`

| File | Purpose |
|------|---------|
| `email-setup.md` | Instructions for SMTP / auth email templates in Supabase |
| `migrations/001_initial_schema.sql` | Initial tables: sessions, GSTR-2B and PR line items, results, `app_config`, triggers |
| `migrations/002_sessions_user_guest.sql` | Adds `user_id` (FK to `auth.users`) and `is_guest` on `reconciliation_sessions` |
| `migrations/003_sessions_client.sql` | Adds `client_gstin` and `client_name` on sessions with lookup indexes |
| `migrations/004_reconciliation_result_status_expand.sql` | Expands `reconciliation_results.status` check (e.g. `Duplicate`, `RCM Invoice`) |
| `migrations/005_qrmp_delay_status.sql` | Adds `QRMP Delay` to `reconciliation_results.status` check constraint |
| `migrations/006_itc_risk_low.sql` | Adds `Low` to `reconciliation_results.itc_risk` check constraint |
| `migrations/007_reconciliation_status_expand.sql` | Adds ITC/POS/CESS/tax-rate statuses (`ITC Blocked`, `POS Mismatch`, etc.) |
| `migrations/008_free_tier_max_reconciliations.sql` | Sets `app_config.free_tier_max_reconciliations` (guest cap, default 15) |

## Generated / vendor / gitignored (not enumerated file-by-file)

| Path | Purpose |
|------|---------|
| `node_modules/` | Installed npm packages |
| `.next/` | Next.js production and dev build output |
| `next-env.d.ts` | Next.js TypeScript references (see `.gitignore`) |
| `*.tsbuildinfo` | TypeScript incremental cache (see `.gitignore`) |
