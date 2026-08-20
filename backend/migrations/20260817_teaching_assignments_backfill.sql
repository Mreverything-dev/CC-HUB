-- One-time backfill: turn existing single-advisor section ownership into
-- Teaching Assignment rows, so the new many-professors-per-section model has
-- no gaps for sections that already have an advisor.
--
-- Run this ONLY after the backend has been restarted at least once with the
-- TeachingAssignment model registered (app/models/__init__.py), since that
-- restart is what creates the teaching_assignments table via
-- Base.metadata.create_all. Running this before the table exists will fail.
--
-- Schedule is left as a zero-duration placeholder (00:00-00:00) because the
-- old advisor_id link never recorded a subject/schedule. A zero-duration
-- range can never overlap a real one, so these placeholder rows are inert
-- for schedule-conflict checks until a professor edits them with a real
-- schedule via the app's "Edit Teaching Assignment" action.
--
-- Idempotent: safe to re-run. Re-running will not create duplicate rows for
-- a professor/section/subject pair that's already been backfilled, because
-- the WHERE NOT EXISTS guard below checks for an existing active row with
-- the same professor_id/section_id/subject before inserting.
INSERT INTO teaching_assignments (
    id, professor_id, section_id, subject, schedule_days,
    schedule_start, schedule_end, status, created_at, updated_at
)
SELECT
    gen_random_uuid(),
    s.advisor_id,
    s.id,
    COALESCE(NULLIF(s.course, ''), s.name),
    '[]'::json,
    '00:00'::time,
    '00:00'::time,
    'active',
    COALESCE(s.created_at, now()),
    COALESCE(s.updated_at, now())
FROM sections s
WHERE s.advisor_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM teaching_assignments ta
      WHERE ta.professor_id = s.advisor_id
        AND ta.section_id = s.id
        AND ta.subject = COALESCE(NULLIF(s.course, ''), s.name)
        AND ta.status = 'active'
  );
