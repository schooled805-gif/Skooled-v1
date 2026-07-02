---
name: Attendance report aggregation
description: How the teacher attendance report collapses records to avoid inflation
---

## Rule
`GET /api/attendance/report` collapses attendance to ONE status per student per
day before counting. The register can hold multiple records per student per day
(subject-period registers, since subject_id is optional on marking), so naive
counting inflates totals. When a day has several statuses the most concerning
wins: absent > late > excused > present. Rate = (present+late)/(present+absent+late)
over recorded days; excused is neutral (excluded from the denominator).

**Why:** a review flagged that summing raw records double-counts multi-subject days.

**How to apply:** keep the per-(student,date) collapse if the report semantics
change; if per-subject/per-period rates are ever wanted, add a separate endpoint
rather than removing the collapse.
