---
name: Parent-student link authorization
description: Parent-student links are the trust root for fees/account access; they must never be client-forgeable
---

## Rule
`parent_student_links` is the authorization source for parent access to a child's
fees/account (fees routes call `isLinkedParent`/`isStudentLinkedToParent`). Any
endpoint that creates/reads/deletes these links MUST derive the actor identity
server-side from the verified session and validate school consistency — never
trust client-supplied `parent_user_id`/`school_id`.

**Why:** The link-create endpoint was once public and inserted client-supplied
fields with no auth, so anyone could forge a link binding their own account to
another child and then pass fees authorization (broken access control).

**How to apply:**
- Link create/list/delete require a verified JWT (not in PUBLIC_ROUTES).
- Parent role: parentUserId = verified caller; schoolId = caller's profile school; the student must be in that school.
- Admin role: may act on a parent in the admin's own school only.
- Because link creation needs a session, parent signup can't link at signup time when email confirmation is on. Selected children are stashed client-side and flushed by AuthContext on first authenticated parent load (see `artifacts/skolr/src/lib/pendingLinks.ts`).
