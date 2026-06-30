---
name: Multi-select fan-out endpoint scoping
description: Server-side authorization rules for teacher/parent fan-out endpoints (messaging, approvals, attendance, lost & found claims).
---

Any endpoint that fans a single request out to many students/parents (messaging
broadcast, bulk approvals, attendance register) MUST constrain a teacher to
their own classes server-side — the UI multi-select is not a security boundary.

**Why:** A teacher selecting "by grade/subject/individual" could otherwise target
the entire school. `resolveStudentIds(schoolId, scope)` only constrains by school;
pass an `allowedClassIds` set (from `getTeacherClassIds`) for teachers so resolved
students outside their classes are dropped. Admins pass `undefined` (whole school).

**How to apply:**
- Teacher fan-out (broadcast, approvals/bulk): compute `allowedClassIds` when
  `role === "teacher"` and pass as 3rd arg to `resolveStudentIds`.
- Attendance: teachers must supply a `class_id` they own (reject missing class_id),
  and `GET /attendance` must filter rows to the teacher's classes.
- Lost & Found claim: require `role === "parent"` AND verify the claimed student is
  linked to that parent (`isStudentLinkedToParent`) — same-school is not enough.

**Contract note:** web pages talk to these routes with raw `fetch` (no codegen), so
field names must match the route's `mapXxx`/`req.body` exactly. school-links uses
`label` (not `title`) and has no `description`/`is_active` columns.
