---
name: Date-only (YYYY-MM-DD) handling in Skolr
description: Rules for handling date-only strings to avoid timezone off-by-one bugs
---

## Rule
Attendance and calendar data use date-only `YYYY-MM-DD` text (no time).
- To compare a range, compare the strings directly — lexicographic order is chronological. Do NOT build Date objects for range checks.
- To get "today" as a date-only string, build it from LOCAL parts
  (`getFullYear/getMonth/getDate`), never `new Date().toISOString().slice(0,10)`
  (that is UTC and is a day early for users behind UTC).
- To display a day-of-month from a `YYYY-MM-DD` string, slice it
  (`Number(s.slice(8,10))`); `new Date('YYYY-MM-DD').getDate()` parses as UTC
  midnight and can render the previous day locally.

**Why:** SA users are UTC+2 so ISO-based "today" is usually fine there, but the
bug surfaces for any user behind UTC; a code review caught the latent off-by-one.

**How to apply:** anywhere in artifacts/skolr that renders/compares the term
calendar (src/lib/termCalendar.ts, src/components/TermCalendar.tsx) or attendance dates.
