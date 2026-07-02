---
name: School phases feature
description: How per-phase tabbing/filtering works across the Skolr admin app
---

# School phases

Schools have `phases text[]` (allowed: nursery|pre_primary|primary|high). Classes,
subjects and profiles carry a single `phase text` column. Students and timetable
entries have NO phase column — they derive phase from their `class_id`.

**Filter predicate (everywhere):** `!multiPhase || item.phase === activePhase || !item.phase`.
**Why:** legacy rows created before phases (null phase) must stay visible under every
tab, otherwise existing data silently disappears for multi-phase schools.

**multiPhase = phases.length > 1.** Tabs (PhaseTabs) and new-row phase tagging only
activate when multiPhase; with 0/1 phase the UI behaves exactly as pre-feature.

**Enrolment/assignment dialogs must NOT phase-filter their class dropdowns.** The
active phase tab is a LIST filter, not an enrolment boundary. Show ALL classes
(labelled by phase when multiPhase) in add/edit-student dialogs, else admins cannot
enrol into a phase whose tab isn't active (real bug: "can't add high-school students").

**Server validation:** `normalizePhase` in api-server `src/lib/validation.ts` coerces any
non-allowed phase value to null on create/update of classes/subjects/profiles/teachers.
**Why:** an invalid phase string would hide a row from all tabs; coercing to null keeps it
visible under all tabs instead of vanishing.

**Known gap (left as-is, out of scope):** `POST /teachers/invite` lacks requireAdmin and
trusts client `school_id` — pre-existing, flagged in review.

## Meal-menu schools (nursery + pre_primary only)
- `isMealMenuSchool(phases)` = phases set is exactly {nursery, pre_primary}. Such schools have NO tuckshop; admin nav swaps the Tuckshop link for a `/admin/menu` "Daily Menu" page.
- `daily_menus` table: one row per (school_id, menu_date) — UNIQUE constraint enables atomic `onConflictDoUpdate` upsert. meals = JSON array of {slot, description}.
- POST/DELETE `/api/daily-menu` are requireAdmin + school-scoped; POST also re-checks `isMealMenuSchool` server-side (don't trust UI gating). GET is school-scoped (any same-school user can read).
- Only admin nav is swapped — parent/student tuckshop tabs intentionally left as-is.
