---
name: API endpoint workflow & teacher/recipient id mapping
description: How to add an API endpoint in this monorepo, and the profiles.id vs auth user_id distinction for messaging.
---

# Adding an API endpoint

The API contract lives in `lib/api-spec/openapi.yaml` (OpenAPI 3.1.0). Orval
generates BOTH the react-query client (`@workspace/api-client-react`) and zod
schemas (`@workspace/api-zod`) from it.

**How to apply:**
1. Edit `openapi.yaml` (path + any `components/schemas`). Nullable fields use
   3.1 style `type: ["string", "null"]`; nullable object refs use
   `anyOf: [ {$ref}, {type: "null"} ]`.
2. Run `pnpm --filter @workspace/api-spec run codegen` (runs orval + typechecks libs).
3. Implement the Express handler under `artifacts/api-server/src/routes/`.
4. **Restart the api-server workflow** — its dev script is `build && start`
   (esbuild, one-shot, NOT a watcher), so new routes don't appear until restart.

When consuming a generated list hook WITH a `query` options object, you must
pass an explicit `queryKey` (e.g. `getListXQueryKey(params)`); omitting it is a
type error.

# teacher_id (profiles.id) vs messaging recipient (auth user_id)

`classes.teacher_id` and `timetable_entries.teacher_id` reference
`profiles.id` (the profile row PK). But `messages.recipient_id` /
`messages.sender_id` are the Supabase **auth user id** (`profiles.user_id`,
text). To start a conversation with a teacher you must join `profiles` and
return `profiles.user_id`, not the profile id.

**Why:** mixing these silently creates conversations with a non-existent
recipient (no messages ever delivered).
