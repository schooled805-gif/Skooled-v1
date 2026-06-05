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

## Never throw at module load in lib/db (Vercel crash class)
`lib/db` resolves the connection string at import time. If that code THROWS
(e.g. "On Vercel POSTGRES_URL must be set"), it crashes the entire Vercel
serverless function as `FUNCTION_INVOCATION_FAILED` on EVERY `/api/*` route —
which also blanks the SPA home page (it hangs on `/api/profiles/me`). So a DB
misconfig must fail at *query time* (clean per-request 500), never at import.
**Why:** a single import-time throw takes down frontend + API together and
gives an opaque error with no diagnostic.
**How to apply:** on Vercel, prefer POSTGRES_URL/POSTGRES_* but fall back to an
external (non-`helium`/non-`*.replit.*`) DATABASE_URL; if nothing is usable,
log and return undefined + use a harmless placeholder Pool. Keep the
non-Vercel order DATABASE_URL → POSTGRES_URL → parts so Replit dev/deploy is
unaffected.

## Vercel env is SEPARATE from Replit secrets
Vercel deploys from the GitHub repo (main branch) and has its OWN environment
variables — it CANNOT read Replit Secrets. So a DB connection added in Replit
(SUPABASE_DB_URL etc.) does nothing for the live Vercel site. To fix a crashed
Vercel deploy you must set the connection string IN THE VERCEL DASHBOARD
(Settings → Environment Variables) as `POSTGRES_URL`, then redeploy.
**Why:** repeated confusion — fixing the Replit secret never fixed the Vercel
site because the two environments are wholly separate.
**Supabase pooler connection identity** (non-secret): user
`postgres.<project_ref>`, host `aws-1-eu-west-2.pooler.supabase.com`, port 6543
(transaction pooler), db `postgres`, TLS required. The username MUST carry the
`.<project_ref>` tenant suffix or the pooler returns "Invalid format for user
or db_name" / "password authentication failed for user postgres".

## Import-time throws are forbidden in ANY module on the Vercel path
The lib/db crash had a TWIN in api-server/lib/supabase.ts (threw when
SUPABASE_URL/SERVICE_ROLE_KEY missing). Same symptom: FUNCTION_INVOCATION_FAILED
on every /api/* route + blank SPA. Rule: NO module reachable from the Vercel
bundle entry (api/index.mjs → app.mjs → routes → middleware → libs) may throw at
module load on missing config. Log + use a placeholder/`*Configured` flag, then
fail per-request (401/503/500). When a Vercel deploy still crashes after fixing
one module, grep the whole import chain for top-level `throw new`.
**Vercel needs BOTH:** POSTGRES_URL (DB) AND SUPABASE_URL +
SUPABASE_SERVICE_ROLE_KEY (auth) set in its own dashboard — DB alone isn't enough.

## pino-pretty transport crashes Vercel at startup
pino's `transport: { target: "pino-pretty" }` runs in a worker thread
(thread-stream) resolved by FILE PATH. In a bundled Vercel serverless function
that worker can't be spawned, so the logger throws at module load →
FUNCTION_INVOCATION_FAILED on EVERY route (same blank-site symptom as an
import-time throw). Gate the pretty transport on `!isProduction && !VERCEL &&
!AWS_LAMBDA_FUNCTION_NAME` — never rely on NODE_ENV alone. Plain JSON pino
(no transport) is safe on serverless.

## Vercel "Redeploy" reuses the OLD commit
The Redeploy button on an existing deployment rebuilds THAT deployment's commit,
NOT the latest GitHub commit. After pushing a fix, you must either let the Git
integration auto-deploy the new commit, or redeploy from the newest deployment
in the list. Redeploying the old one just rebuilds the broken code.

## pg >=8.20 treats sslmode=require as verify-full → rejects Supabase cert
With modern node-postgres, putting `?sslmode=require` in the connection string is
interpreted as `verify-full` (strict cert verification) and FAILS against
Supabase's pooler with "self-signed certificate in certificate chain", breaking
EVERY query on Vercel (clean 500s, not a startup crash). Fix: NEVER put sslmode in
the connection string; strip it, and enable TLS only via the Pool option
`ssl: { rejectUnauthorized: false }`. Dev (Replit helium, no TLS) is unaffected,
so this bug is invisible locally and only shows up against Supabase.
Supabase connection must use the TRANSACTION POOLER (host *.pooler.supabase.com,
port 6543, user postgres.<projectref>) — the direct host is IPv6-only and
unreachable from Vercel serverless.
