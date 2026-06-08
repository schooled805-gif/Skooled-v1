---
name: Admin authorization & disabled-user gate
description: How admin-only mutations and disabled-account blocking are enforced server-side in the API.
---

# Admin role authorization

Most write routes historically only scoped by school (`getRequesterSchoolId` / target `schoolId` check) and did NOT verify role. That means any authenticated same-school user (parent/student/teacher) could call admin-style mutations directly.

**Rule:** destructive / privileged mutations (managing users, crediting tuckshop balances, etc.) must call `requireAdmin(req)` from `lib/scope.ts`. It returns the admin `Profile` (role==='admin' + has schoolId) or null. Then still check `target.schoolId === admin.schoolId` and reject self-targeting (`target.id === admin.id`) where applicable.

**Why:** UI hiding a control is not a security boundary; school scope alone allowed same-tenant privilege escalation (architect-flagged critical).

**How to apply:** when adding any admin-only endpoint, gate with `requireAdmin` first, then tenant-check the target. Don't assume other existing routes already do this — many only scope by school.

# Disabled-user enforcement

`verifySupabaseJwt` (middleware/auth.ts) blocks `profile.status === "disabled"` on all protected routes, EXCEPT `/profiles/me` (so the disabled client can still fetch its own status and render the disabled-account screen). A missing profile (first login before profile setup) is NOT blocked.

**Why:** "disable user" must actually stop API access, not just hide the portal. Frontend gating alone let a disabled user with a valid token hit APIs.

**How to apply:** the gate adds one profile-status lookup per protected request — acceptable at this scale. If you add new public/self routes that a disabled user must reach, extend the exemption alongside `/profiles/me`.

# Tuckshop accounts

`/tuckshop/accounts` "active" = `prof?.status === "approved"` (positive predicate), not a negative not-disabled/not-rejected check, so pending profiles are excluded. Parent top-ups go through `/fees/pay/initiate` (Ozow/Paystack), credited on verified webhook — `/tuckshop/topup` is admin-only manual back-office credit.
