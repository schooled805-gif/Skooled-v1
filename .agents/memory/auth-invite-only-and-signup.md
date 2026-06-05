---
name: Skolr auth — invite-only teachers & signup duplicate-email
description: How teacher accounts and duplicate-email signup must behave in the Skolr web app.
---

## Invite-only teachers
Teachers are created ONLY by a school admin via `POST /api/teachers/invite` — never self-registered.
- The invite endpoint must run the Supabase `/auth/v1/invite` call FIRST and link the profile to the real Supabase user `id` it returns, so the teacher resolves by `user_id` on first login and is never pushed into the "create account" (ProfileSetup) flow.
- `GET /api/profiles/me` keeps an email-based fallback that "claims" a placeholder-`user_id` profile on first login (covers invite-email failures and legacy rows, e.g. an admin row with an empty `user_id`).
- **Server-side enforcement is mandatory:** public `POST /api/profiles` must reject `role:"teacher"` with 403. Hiding the option in Signup/ProfileSetup UI is NOT a security control.
**Why:** users reported teachers being forced into account creation; the model is admin-provisioned teachers only.

## Signup duplicate-email
Reject an already-used email BEFORE `supabase.auth.signUp` via public `GET /api/profiles/email-exists?email=`.
- Every real user has a profiles row, so this catches existing admins/parents/invited-teachers with one clear message and avoids creating an orphaned Supabase auth user (Supabase's silent obfuscation returns `identities:[]`, which is also handled as a backup).
- Keep the response minimal (`{exists}` only — do NOT leak `role`) to limit account enumeration. Preflight network errors are ignored so a transient failure doesn't block legit signups.
**How to apply:** any new public profile-creation or signup path must keep both the preflight check and the server-side teacher rejection.

## Env note
api-server dev (tsx) does NOT reliably hot-reload route/middleware changes — restart the `artifacts/api-server: API Server` workflow after editing routes or `app.ts` before testing.
