-- Adds subject_code and room to teaching_assignments (e.g. "MELEC 8" /
-- "COMLAB 1"), so a subject can carry a short catalog code and a physical
-- room alongside its existing free-text subject name and schedule.
--
-- Both columns are nullable: existing rows (including the advisor-backfill
-- placeholders from 20260817_teaching_assignments_backfill.sql, and any row
-- created via the "Join Existing Section" flow, which doesn't collect these
-- fields) simply have no code/room until a professor sets one - never a
-- migration-time default guess.
--
-- Idempotent: IF NOT EXISTS means a re-run is a safe no-op.
ALTER TABLE teaching_assignments ADD COLUMN IF NOT EXISTS subject_code VARCHAR(50);
ALTER TABLE teaching_assignments ADD COLUMN IF NOT EXISTS room VARCHAR(100);
