---
name: Applying DDL / migrations to Supabase production
description: How to run schema changes against the external Supabase Postgres prod DB, and the corrupted SUPABASE_DB_URL gotcha.
---

Production runs on Supabase Postgres (separate from the Replit dev DB). Replit's
publish-time schema migration does NOT touch it. Schema changes must be applied
manually with `lib/db/supabase-prod-migration.sql` (idempotent, IF NOT EXISTS).

**Why:** `drizzle-kit push` cannot migrate Supabase via the pooler, and the dev
`push-force` only updates the Replit dev DB. When dev schema advances but prod is
not migrated, the DEPLOYED app breaks (e.g. admin signup inserts `schools.phases`
into a column that does not exist → insert fails AFTER the Supabase Auth user is
created → orphaned auth user → "email already exists" loop on retry).

**How to apply (working method):**
- `executeSql` with `environment:"production"` is READ-ONLY and points at the
  Replit replica, NOT Supabase — cannot run DDL there.
- PostgREST (`${VITE_SUPABASE_URL}/rest/v1/...` + service-role key) cannot run DDL.
- The `SUPABASE_DB_URL` secret is CORRUPTED: it is two connection strings
  concatenated with no separator (the `:5432` session-pooler URL immediately
  followed by the `:6543` transaction-pooler URL). Feeding it raw to psql or
  node-pg fails with `Invalid format for user or db_name`.
- Working path: split off the first URL (`raw.slice(0, raw.indexOf("postgres://"))`
  — note `postgresql://` does not contain `postgres://`), parse host+user from it,
  then connect with node-pg using the dedicated `SUPABASE_DB_PASSWORD` secret as
  the password (the password embedded in the URL is stale/rejected). Use port
  **5432** (session pooler — supports DDL), `database:"postgres"`,
  `ssl:{rejectUnauthorized:false}`. Run `pg` from `lib/db` where it resolves.
  A single multi-statement `pool.query(sql)` applies the whole migration file.

**Project ref / host:** ref `pqcpcrnecrnqfwmaanxr`, pooler host
`aws-1-eu-west-2.pooler.supabase.com`. Supabase Auth is SHARED between dev and prod.
Never print secret values.
