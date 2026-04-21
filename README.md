# GSTRecon (gst-reconciler)

Production-oriented Next.js app for **GSTR-2B vs Purchase Register** B2B reconciliation: parse uploads in the browser, score ITC risk per invoice, persist results to **Supabase**, and export an Excel report.

## Prerequisites

- Node.js **22+** (project targets modern Next.js; use `nvm` / `fnm` if your system Node is older)
- A **Supabase** project (Postgres + anon key)

## Setup

```bash
cd gst-reconciler
npm install
```

Copy environment variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` and set **real** values (never commit secrets). The Supabase client validates the URL at startup, so use a full `https://…supabase.co` URL (the committed template uses a placeholder host you must replace).

- `NEXT_PUBLIC_SUPABASE_URL` — Project URL from Supabase **Settings → API**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — `anon` `public` key (same screen)
- `NEXT_PUBLIC_APP_NAME` — e.g. `GSTRecon`
- `NEXT_PUBLIC_APP_VERSION` — e.g. `1.0.0`

The app reads configuration only from `process.env` / `import.meta` equivalents for these public keys.

## Supabase database

1. Open the Supabase SQL editor for your project.
2. Paste and run the migration at `src/supabase/migrations/001_initial_schema.sql`.

This creates tables `reconciliation_sessions`, `gstr2b_invoices`, `purchase_register_invoices`, `reconciliation_results`, `app_config`, indexes, and the `sessions_updated_at` trigger.

If the trigger statement errors on older Postgres, replace `EXECUTE FUNCTION` with `EXECUTE PROCEDURE` for the same trigger definition.

### Row Level Security (optional)

If you enable RLS on these tables, add policies that allow the operations your deployment needs (e.g. anonymous insert/select for a public demo, or authenticated users only). The API routes use the **anon** client as wired in `src/lib/supabase.ts`.

## Run locally

```bash
npm run dev
```

- Landing: [http://localhost:3000](http://localhost:3000)
- Reconcile: [http://localhost:3000/reconcile](http://localhost:3000/reconcile)

## Build

```bash
npm run build
```

Ensure `.env.local` contains non-empty Supabase URL and anon key so `src/lib/supabase.ts` can initialise at import time.

## Deploy to Vercel

1. Push the repository to GitHub/GitLab/Bitbucket.
2. Import the project in [Vercel](https://vercel.com) as a Next.js app.
3. Under **Project → Settings → Environment Variables**, add the same keys as in `.env.example` (with real values for production).
4. `vercel.json` pins the **Mumbai (`bom1`)** region for lower latency in India.

## Project layout (high level)

- `src/app` — App Router pages and `api/*` route handlers
- `src/components` — UI (landing + reconcile + shadcn `ui/`)
- `src/lib` — Types, Supabase client, parsing, reconciliation engine, export, config
- `src/hooks` — Client hooks for config and reconciliation flow
- `src/supabase/migrations` — SQL to run in Supabase

## Licence

Use and modify for your practice or product; ensure compliance with GST law and your own data retention policies.
