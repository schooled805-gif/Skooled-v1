---
name: Multi-tenant file authorization
description: How uploaded report files are isolated per school, and why download auth must not derive from mutable rows.
---

# Multi-tenant file authorization (report uploads)

Uploaded report files are stored under a per-school directory and the returned
URL embeds the school id: `/api/uploads/<schoolId>/<safeName>`. The download
route authorizes by comparing the path's `schoolId` to the requester's
server-derived `getRequesterSchoolId(req)` — not by looking up a report row.

**Why:** An earlier fix authorized downloads by looking up `reports.fileUrl` and
checking that row's `schoolId`. That is unsafe: report rows are client-created,
so a user could insert a report in *their own* school pointing at another
school's filename and pass the check. Authorization must be bound to the file's
own immutable ownership (its path), established at upload time from the trusted
token — never from mutable, client-writable rows.

**How to apply:** Any time a request grants access to a stored asset, the
ownership signal must come from something the client cannot forge (path segment
written server-side at upload, or a dedicated upload-ownership table), validated
against `getRequesterSchoolId(req)`. Also: `POST /reports` derives `schoolId`
server-side and rejects `file_url` not prefixed with the requester's school dir.
Browsers can't send a Bearer header on anchor navigation, so the frontend
fetches the file with the token and opens it as a blob (`lib/viewFile.ts`).
