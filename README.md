# Nalvita — Personal Health Records

A personal health records vault: documents, medicines, vitals, allergies,
conditions, and doctors — all in one place, running entirely on free tiers.

## Repo structure

```
nalvita/
├── packages/
│   ├── core/        ← shared TypeScript types, Zod schemas, utilities
│   ├── web/         ← React + Vite web app (talks to Supabase directly)
│   └── mobile/      ← React Native (Phase 2, empty placeholder)
├── supabase/
│   ├── migrations/  ← database schema as SQL
│   └── functions/   ← Edge Functions (serverless, none yet)
├── .github/workflows/ ← CI (lint + typecheck + test) and Supabase keepalive
└── turbo.json       ← Turborepo task pipeline
```

This is a Turborepo monorepo using npm workspaces. `@nalvita/core` is built
first and consumed by `@nalvita/web` (and later mobile), so validation rules
and types are defined once.

## Running locally

Prerequisites: Node ≥ 20, Docker (for local Supabase), and the
[Supabase CLI](https://supabase.com/docs/guides/local-development).

```sh
# 1. Install dependencies
npm install

# 2. Start the local Supabase stack (Postgres, Auth, Storage, Studio).
#    This applies everything in supabase/migrations automatically.
supabase start

# 3. Configure env vars: copy .env.example to packages/web/.env and fill in
#    the URL + anon key that `supabase start` printed.

# 4. Start the dev servers
npm run dev
```

Other commands (each runs across all packages via Turborepo):

```sh
npm run build      # build all packages
npm run lint       # ESLint
npm run typecheck  # TypeScript --noEmit
npm run test       # Vitest
```

## Zero-cost stack decisions

Everything runs on free tiers — no credit card required anywhere.

- **No custom backend server (`packages/api`) in Phase 1.** Supabase handles
  auth, database, storage, and CRUD directly from the frontend, secured by
  row-level security. A server is added only when genuinely needed (Claude AI
  integration in Phase 3, or phone OTP).
- **Supabase (free tier)** — Postgres, Auth (email OTP + Google OAuth),
  private file storage, Edge Functions. 500 MB DB, 1 GB storage, 50k MAU.
  Project region: `ap-south-1` (Mumbai). The free tier pauses after 7 days of
  inactivity; a weekly GitHub Actions ping (`supabase-keepalive.yml`) prevents
  that.
- **Vercel (Hobby tier)** — hosts the web app. Push to `main` deploys to
  production; every PR gets a preview URL. 100 GB bandwidth/month.
- **GitHub Actions (free tier)** — lint + typecheck + test on every PR,
  well within the free 2,000 minutes/month.
- **Sentry (free tier)** — error tracking, 5k errors/month. DSN documented in
  `.env.example`.
- **Deferred to keep costs at zero:** phone/SMS OTP (SMS costs money even at
  low volume — email OTP and Google login are free).

## Database

Schema lives in `supabase/migrations/`. Seven user-scoped tables — `profiles`,
`documents`, `medicines`, `vitals`, `allergies`, `conditions`, `doctors` —
each with a `user_id` referencing `auth.users` and row-level security policies
so users can only read/write their own rows. Uploaded files go to the private
`health-documents` storage bucket (20 MB/file limit, PDF/JPG/PNG only),
accessed via short-lived signed URLs.

To create a new migration:

```sh
supabase migration new <name>   # writes supabase/migrations/<timestamp>_<name>.sql
supabase db reset               # re-applies all migrations locally
supabase db push                # applies pending migrations to the linked cloud project
```
