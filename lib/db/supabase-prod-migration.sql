-- ─────────────────────────────────────────────────────────────────────────────
-- Skolr production schema sync for Supabase Postgres
--
-- These are the schema changes introduced by the activities/subject-teachers/
-- class-disable batch. They have already been applied to the local Replit dev DB
-- (via `pnpm --filter @workspace/db run push-force`) but the Vercel production
-- app runs against Supabase Postgres, which is a SEPARATE database and is NOT
-- updated by that command.
--
-- IMPORTANT: `drizzle-kit push` does NOT work against Supabase's transaction
-- pooler (port 6543). Apply this SQL with a single long-lived psql / pg client
-- session against the Supabase connection instead. Every statement is idempotent
-- (IF NOT EXISTS), so it is safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. classes.status — enables disabling a class (hides it from offering pickers)
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'; -- active | disabled

-- 2. subject_teachers — assigns teachers to subjects
CREATE TABLE IF NOT EXISTS subject_teachers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  uuid NOT NULL,
  teacher_id  uuid NOT NULL,
  school_id   uuid NOT NULL,
  created_at  timestamp DEFAULT now()
);

-- 3. activity_providers — external companies that run extra-mural activities
CREATE TABLE IF NOT EXISTS activity_providers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  contact_name  text,
  contact_email text,
  contact_phone text,
  school_id     uuid NOT NULL,
  created_at    timestamp DEFAULT now()
);

-- 4. activities — extra-mural activities (internal coach OR external provider)
CREATE TABLE IF NOT EXISTS activities (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  description      text,
  category         text,                       -- sport | music | cultural | academic | other
  is_external      boolean NOT NULL DEFAULT false,
  coach_teacher_id uuid,                        -- profiles.id (internal coach/teacher)
  provider_id      uuid,                        -- activity_providers.id (external company)
  day_of_week      text,
  start_time       text,
  end_time         text,
  location         text,
  school_id        uuid NOT NULL,
  created_at       timestamp DEFAULT now()
);

-- 5. activity_signups — a student enrolled in an activity (by their parent)
CREATE TABLE IF NOT EXISTS activity_signups (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id    uuid NOT NULL,
  student_id     uuid NOT NULL,
  parent_user_id text,
  status         text NOT NULL DEFAULT 'active', -- active | cancelled
  school_id      uuid NOT NULL,
  created_at     timestamp DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- School phases + daily menus batch
-- ─────────────────────────────────────────────────────────────────────────────

-- 6. school phases — schools split into per-phase tabs; teachers belong to one phase
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS phases text[]; -- nursery | pre_primary | primary | high

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phase text;    -- single phase a teacher belongs to

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS phase text;

ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS phase text;

-- 7. daily_menus — meal menu for nursery/pre-primary-only schools (no tuckshop)
CREATE TABLE IF NOT EXISTS daily_menus (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL,
  menu_date   text NOT NULL,                 -- YYYY-MM-DD
  meals       text NOT NULL DEFAULT '[]',    -- JSON array of { slot, description }
  created_by  text,
  created_at  timestamp DEFAULT now(),
  updated_at  timestamp
);

-- One menu per school per date (enables atomic upsert via ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS daily_menus_school_date_unique
  ON daily_menus (school_id, menu_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fees / online payments batch
-- ─────────────────────────────────────────────────────────────────────────────

-- 8. fee_accounts — per-student fee balance
CREATE TABLE IF NOT EXISTS fee_accounts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    uuid NOT NULL UNIQUE,
  school_id     uuid NOT NULL,
  balance_cents integer NOT NULL DEFAULT 0,
  updated_at    timestamp DEFAULT now()
);

-- 9. fee_ledger — immutable ledger of charges/adjustments/payments
CREATE TABLE IF NOT EXISTS fee_ledger (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL,
  student_id   uuid NOT NULL,
  school_id    uuid NOT NULL,
  amount_cents integer NOT NULL,
  type         text NOT NULL,                 -- charge | adjustment | payment
  description  text,
  reference_id text,                          -- e.g. fee_payments.id for payments
  created_by   text,                          -- admin user_id, or "system" for provider payments
  created_at   timestamp DEFAULT now()
);

-- 10. fee_payments — online payment attempts (Ozow / Paystack)
CREATE TABLE IF NOT EXISTS fee_payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         uuid NOT NULL,
  school_id          uuid NOT NULL,
  parent_user_id     text,
  provider           text NOT NULL,           -- ozow | paystack
  reference          text NOT NULL UNIQUE,    -- our server-generated unique ref
  provider_reference text,                     -- provider's transaction id
  amount_cents       integer NOT NULL,
  status             text NOT NULL DEFAULT 'pending', -- pending | complete | failed | cancelled
  ledger_entry_id    uuid,
  created_at         timestamp DEFAULT now(),
  updated_at         timestamp
);

-- ─────────────────────────────────────────────────────────────────────────────
-- BATCH F1–F10 (canteen email, forced password change, lost & found, links, attendance)
-- ─────────────────────────────────────────────────────────────────────────────

-- 11. schools.canteen_email — admin-configurable destination for tuckshop order emails
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS canteen_email text;

-- 12. profiles.must_change_password — force a password change on next login
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- 13. school_links — external links (e.g. uniform shop), admin CRUD
CREATE TABLE IF NOT EXISTS school_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  uuid NOT NULL,
  label      text NOT NULL,
  url        text NOT NULL,
  category   text NOT NULL DEFAULT 'uniform',  -- uniform | shop | other
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now()
);

-- 14. lost_found_items — lost & found board
CREATE TABLE IF NOT EXISTS lost_found_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id          uuid NOT NULL,
  title              text NOT NULL,
  description        text,
  category           text,                      -- clothing | electronics | stationery | other
  photo_url          text,
  status             text NOT NULL DEFAULT 'open', -- open | claimed | resolved
  location_found     text,
  posted_by_user_id  text,
  posted_by_name     text,
  claimed_by_user_id text,
  claimed_by_name    text,
  claimed_student_id uuid,
  claim_note         text,
  claimed_at         text,
  created_at         timestamp DEFAULT now(),
  updated_at         timestamp
);

-- 15. attendance_records — register marking per class/subject per day
CREATE TABLE IF NOT EXISTS attendance_records (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         uuid NOT NULL,
  student_id        uuid NOT NULL,
  class_id          uuid,
  subject_id        uuid,
  date              text NOT NULL,              -- YYYY-MM-DD
  status            text NOT NULL DEFAULT 'present', -- present | absent | late | excused
  note              text,
  marked_by_user_id text,
  created_at        timestamp DEFAULT now(),
  updated_at        timestamp
);

-- ============================================================================
-- BATCH 2: free-text approvals, activity seasons/dates, parent custom events
-- ============================================================================

-- 16. approvals — allow free-text requests (nullable event_id + title/description)
ALTER TABLE approvals ALTER COLUMN event_id DROP NOT NULL;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS title       text;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS description text;

-- 17. activities — recurrence season + optional term/season date range
ALTER TABLE activities ADD COLUMN IF NOT EXISTS season     text NOT NULL DEFAULT 'weekly';
ALTER TABLE activities ADD COLUMN IF NOT EXISTS start_date text;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS end_date   text;

-- 18. custom_events — parent-added extra participation for their own child
CREATE TABLE IF NOT EXISTS custom_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id text NOT NULL,
  student_id     uuid NOT NULL,
  title          text NOT NULL,
  description    text,
  days_of_week   text[],
  start_time     text,
  end_time       text,
  start_date     text,                        -- YYYY-MM-DD (inclusive)
  end_date       text,                        -- YYYY-MM-DD (inclusive)
  location       text,
  school_id      uuid NOT NULL,
  created_at     timestamp DEFAULT now()
);
