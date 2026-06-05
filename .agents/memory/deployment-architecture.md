---
name: Deployment architecture (Replit + Vercel)
description: How this monorepo deploys, where data really lives, and the Vercel "Emit skipped" gotcha.
---

# Deployment architecture

This project was migrated from a standalone Vercel app into a Replit
multi-artifact pnpm monorepo. It targets BOTH Replit (autoscale) and Vercel.

## Where data lives (common confusion)
- App data is in **Replit-managed PostgreSQL** (`DATABASE_URL`, host `helium`),
  accessed via Drizzle (`lib/db`). Schema is pushed with `drizzle-kit push`.
- **Supabase is auth-only** (JWT verification via service-role key). It does NOT
  store the app's data tables. Looking for tables in the Supabase dashboard will
  show nothing — that is by design.

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
- `vercel.json` (repo root): `framework:null`, build = `pnpm --filter
  @workspace/api-server run build`, rewrite `/(.*) → /api`.

## Required Vercel dashboard settings (NOT in repo, must be set by user)
- **Root Directory = repository root** (where `/api` and `vercel.json` live), not
  `artifacts/api-server`. Wrong root breaks function discovery + rewrites.
- Runtime env vars: `DATABASE_URL`, `VITE_SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` (some routes also read `SUPABASE_URL`).

## Pino in serverless
`src/lib/logger.ts` disables the pino-pretty transport when
`NODE_ENV==="production"`, so prod logs JSON to stdout with no worker threads —
the emitted `dist/pino-*.mjs` worker files are not needed at runtime in prod.
