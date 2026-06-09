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
