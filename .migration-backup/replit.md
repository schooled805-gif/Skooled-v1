# Skolr

A production-ready school super app with four role-based portals: Parent (purple), Teacher (green), Student (coral/orange), Admin (blue).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/skolr run dev` — run the Skolr frontend (auto-assigned port, proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only); run `pnpm run typecheck:libs` after to rebuild declarations
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase auth credentials

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui components + wouter routing
- API: Express 5 (on port 8080, proxied at `/api`)
- Auth: Supabase (email/password) — user ID passed as `x-user-id` header to backend
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth for all API shapes)
- `lib/api-client-react/src/generated/api.ts` — generated React Query hooks (do not edit manually)
- `lib/api-zod/src/generated/` — generated Zod schemas for server validation
- `lib/db/src/schema/index.ts` — Drizzle schema (source of truth for DB tables)
- `artifacts/skolr/src/` — React frontend
  - `contexts/AuthContext.tsx` — Supabase auth + profile fetch (no React Query hooks inside)
  - `App.tsx` — routing with role-based AuthGuard
  - `pages/admin/` — Admin portal (blue)
  - `pages/parent/` — Parent portal (purple)
  - `pages/teacher/` — Teacher portal (green)
  - `pages/student/` — Student portal (orange/coral)
  - `pages/public/` — Landing, Login, ResetPassword
  - `components/layout/PortalLayout.tsx` — shared sidebar layout for all portals
- `artifacts/api-server/src/routes/` — Express route handlers

## Architecture decisions

- **Auth pattern**: Supabase handles auth on the frontend; the backend trusts the `x-user-id` header (passed from the Supabase session). No JWT validation on the server (suitable for internal/school use; can be upgraded to JWT verification later).
- **AuthContext avoids React Query hooks**: `AuthContext.tsx` fetches the user profile via plain `fetch()` to avoid calling React Query hooks before `QueryClientProvider` mounts.
- **OpenAPI-first**: All API shapes are defined in `lib/api-spec/openapi.yaml` first, then codegen produces hooks and Zod validators. Never manually edit generated files.
- **Role-based routing**: After login, the profile `role` field (`admin | teacher | parent | student`) determines which portal path the user is redirected to.
- **DB composite lib**: After changing `lib/db/src/schema/index.ts`, run `pnpm run typecheck:libs` to rebuild type declarations before the API server can pick up the changes.

## Product

- **Landing page** — public marketing page with four portal cards
- **Login** — Supabase email/password auth with role-based redirect
- **Admin portal** — Dashboard, Users, Students, Classes, Timetable, Events, Approvals, Reports, Announcements
- **Parent portal** — Dashboard, Schedule (child's timetable), Approvals (consent requests), Messages (teacher chat), Reports
- **Teacher portal** — Dashboard, My Classes, Messages (parent chat), Approvals, Announcements
- **Student portal** — Dashboard, Timetable, Reports (visible ones only), Announcements

## User preferences

_None recorded yet._

## Gotchas

- **Never call React Query hooks inside `AuthContext`** — it runs before `QueryClientProvider` mounts, causing "Cannot read properties of null (reading 'useContext')" errors. Use plain `fetch()` instead.
- **Do not use `pnpm dev` at the workspace root** — run dev via workflows or `pnpm --filter @workspace/<name> run dev`.
- **Early `return` in Express 5 routes**: Use `{ res.status(404).json(...); return; }` instead of `return res.status(404).json(...)` — Express 5 infers stricter async return types.
- **After DB schema changes**: Run `pnpm --filter @workspace/db run push` (migrations) then `pnpm run typecheck:libs` (rebuild declarations) before restarting the API server.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
