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

**Server validation:** `normalizePhase` in api-server `src/lib/validation.ts` coerces any
non-allowed phase value to null on create/update of classes/subjects/profiles/teachers.
**Why:** an invalid phase string would hide a row from all tabs; coercing to null keeps it
visible under all tabs instead of vanishing.

**Known gap (left as-is, out of scope):** `POST /teachers/invite` lacks requireAdmin and
trusts client `school_id` — pre-existing, flagged in review.
