---
name: Orphaned profiles from non-transactional student create
description: Why student full-create must be transactional; how partial inserts orphaned a profile and surfaced as a 500 on retry
---

## Rule
Any multi-row create that inserts a `profiles` row plus a domain row (e.g. `students`) MUST be wrapped in a single `db.transaction`. `profiles.email` and `profiles.user_id` have UNIQUE indexes (`profiles_email_unique`, `profiles_user_id_unique`).

**Why:** A non-transactional full-create (profile insert, then student insert) once left an orphaned student-profile in prod (Supabase): the profile insert succeeded but the student insert failed (prod schema was behind dev at the time). The orphan's email then collided on every retry via `profiles_email_unique` (Postgres 23505), which older deployed code surfaced as a generic 500 "Internal server error" instead of a 409.

**How to apply:**
- Wrap profile+domain-row inserts in `db.transaction(async (tx) => {...})` so a later failure rolls back the profile.
- Map 23505 → 409 with a clear "already exists" message; the web client surfaces `e.error`.
- To find orphans: `SELECT p.* FROM profiles p LEFT JOIN students s ON s.profile_id=p.id WHERE p.role='student' AND s.id IS NULL`.
- Code fixes to the enrolment path only reach prod after a Vercel redeploy; cleaning the orphaned prod row unblocks users on the current deployment immediately.
