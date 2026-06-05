---
name: Deployment architecture (Replit + Vercel)
description: How this monorepo deploys, where data really lives, and the Vercel "Emit skipped" gotcha.
---

# Deployment architecture

This project was migrated from a standalone Vercel app into a Replit
multi-artifact pnpm monorepo. It targets BOTH Replit (autoscale) and Vercel.

## Where data lives
- **Local Replit dev**: app data in Replit-managed PostgreSQL (`DATABASE_URL`,
  host `helium`, sslmode=disable), via Drizzle (`lib/db`).
- **Vercel production**: app data in **Supabase PostgreSQL**, reached through the
  Vercel Supabase integration's `POSTGRES_URL`. (Data was migrated Replit→Supabase;
  the Replit DB is NOT reachable from Vercel.)
- Connection selection lives in `lib/db/src/index.ts > resolveConnectionString()`:
  on Vercel, `POSTGRES_URL` always wins over any stale `DATABASE_URL`; otherwise
  `DATABASE_URL` → `POSTGRES_URL` → built from `POSTGRES_*` parts.
- Supabase still also provides **auth** (JWT verification via service-role key).

## Supabase Postgres connection gotchas
**Why:** Vercel can't reach Replit's internal DB, so prod data must live in
Supabase, and Supabase's poolers behave unlike a normal Postgres.
**How to apply:**
- TLS is REQUIRED. `lib/db` sets `ssl:{rejectUnauthorized:false}` when the conn
  string matches `supabase.(co|com)` or `sslmode=require` (Supabase pooler serves
  a cert that fails default verification).
- This project's **session pooler (port 5432) is disabled**; only the
  **transaction pooler (port 6543)** accepts connections. The `POSTGRES_*`-parts
  fallback infers `6543` when the host contains `pooler` (else 5432); override
  with `POSTGRES_PORT`.
- `drizzle-kit push` does NOT work against the transaction pooler (introspection /
  prepared-statement issues). To apply schema: `drizzle-kit generate` to SQL, then
  execute the statements via a single long-lived `pg.Client` (split on
  `--> statement-breakpoint`). The pooler occasionally rejects a *fresh*
  connection with a bogus "password authentication failed" — reuse one client and
  retry connects rather than using a Pool that reconnects per query.

## Vercel build gotcha: "src/routes/*.ts: Emit skipped"
**Why:** Vercel's `@vercel/node` runs `tsc` on the TypeScript source of any
function. The api-server's tsconfig uses project references to `@workspace/db`
and `@workspace/api-zod` whose `dist` declarations are gitignored and not built
at function-compile time → `TS6305` → `noEmitOnError` skips emit → build fails.
The cascading `TS7006`/`TS2339` errors are a symptom (unresolved `@workspace/*`
becomes `any`/`{}`), not the cause.

**How to apply:** Never let Vercel tsc-compile the monorepo source. Serve the
**esbuild bundle** instead:
- `artifacts/api-server/build.mjs` bundles `src/app.ts` → `dist/app.mjs` (the
  bare Express app, default export, no `app.listen`; `src/index.ts` →
  `dist/index.mjs` remains the listen server for Replit).
- `api/index.mjs` (repo root, plain `.mjs` so it is never tsc'd) re-exports the
  bundle: `import app from "../artifacts/api-server/dist/app.mjs"; export default app;`
  An Express app is a `(req,res)` handler, which `@vercel/node` serves directly.

## Vercel serves the FULL app (frontend + API), not API-only
The original standalone Vercel app was the whole product. The `skolr` Vite SPA
calls the API via same-origin relative `/api/...`, so frontend + API live on one
Vercel domain. `vercel.json` (repo root):
- `framework:null`, `installCommand: pnpm install --no-frozen-lockfile`
- `buildCommand`: builds BOTH — api-server bundle AND `@workspace/skolr` (vite).
- `outputDirectory: artifacts/skolr/dist/public` (vite's `build.outDir`).
- rewrites (order matters): `/api/(.*) → /api` (funnels subpaths to the function;
  Vercel preserves the original req.url so Express routes correctly), then
  `/(.*) → /index.html` (SPA fallback for wouter client routing). Static assets
  are served before rewrites; the `/api` function is matched by filesystem.
- Frontend base path defaults to `/` (BASE_PATH unset) → correct for root domain.

## Required Vercel dashboard settings (NOT in repo, must be set by user)
- **Root Directory = repository root** (where `/api` and `vercel.json` live), not
  `artifacts/api-server`. Wrong root breaks function discovery + rewrites.
- Env vars (Vercel exposes these at BOTH build and runtime):
  - Build-time (vite inlines `VITE_*`): the Supabase integration only sets
    `SUPABASE_URL`/`SUPABASE_ANON_KEY` (no `VITE_` prefix), so
    `artifacts/skolr/vite.config.ts` bridges them to `VITE_SUPABASE_URL`/
    `VITE_SUPABASE_ANON_KEY` at build. No manual `VITE_*` vars needed on Vercel.
  - Runtime (API function): DB via `POSTGRES_URL` (Supabase integration),
    plus `SUPABASE_URL`/`VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
    for auth.

## Pino in serverless
`src/lib/logger.ts` disables the pino-pretty transport when
`NODE_ENV==="production"`, so prod logs JSON to stdout with no worker threads —
the emitted `dist/pino-*.mjs` worker files are not needed at runtime in prod.
