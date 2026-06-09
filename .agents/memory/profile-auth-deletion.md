---
name: Profile deletion must also delete Supabase Auth user
description: Deleting a profile row without deleting the Supabase Auth account orphans the email and breaks future signup.
---

Deleting a user (DELETE /api/profiles/:id) must also call
`supabaseAdmin.auth.admin.deleteUser(profile.userId)` (best-effort, log-on-fail,
do not block the DB delete).

**Why:** profiles.userId is the Supabase Auth uid. If only the DB row is removed,
the Auth account lingers. The signup form pre-flights `GET /profiles/email-exists`
(DB-only) then calls `supabase.auth.signUp`; an orphaned Auth account makes signUp
return identities=[] ("already registered") even though the preflight passed — the
user sees a confusing "could not create" error and the email is unusable.

**How to apply:** any path that removes a user (admin delete, bulk wipe) must clear
both the DB row AND the Auth account. To wipe all auth users use
`supabaseAdmin.auth.admin.listUsers({page,perPage})` + `deleteUser` in a loop
(service-role key required). api-server has no tsx; run one-off scripts as plain
`node script.mjs` from the artifacts/api-server dir so @supabase/supabase-js resolves.
