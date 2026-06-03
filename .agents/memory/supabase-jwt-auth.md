---
name: Supabase JWT auth pattern
description: How API server verifies Supabase tokens and how web/mobile clients must send them.
---

**API Server side** (`artifacts/api-server`):
- Uses `@supabase/supabase-js` admin client with `SUPABASE_SERVICE_ROLE_KEY`
- `verifySupabaseJwt` middleware: strips any client-supplied `x-user-id`, calls `supabaseAdmin.auth.getUser(token)`, sets `x-user-id`/`x-user-email` only on success
- `stripClientUserHeaders`: for public routes — strips client headers, doesn't require a token
- Public routes: `GET /api/health`, `GET /api/schools/:id`, `POST /api/profiles`
- All other `/api` routes require a verified JWT

**Web App side** (`artifacts/skolr`):
- All API calls send `Authorization: Bearer ${session?.access_token}`
- `useAuth()` exposes `session` — destructure it alongside `user`
- `apiFetch(url, token, options)` — second param is the Bearer token, NOT user.id
- `AuthContext.fetchProfile` takes `(user, accessToken)` and uses Bearer header

**Why:** The old system trusted `x-user-id` headers from any client — any request could impersonate any user. The new system only sets `x-user-id` server-side after cryptographic JWT verification.

**How to apply:** Any new page/component that calls the API must destructure `session` from `useAuth()` and pass `session?.access_token` to API calls. Never pass `user?.id` as an auth token.
