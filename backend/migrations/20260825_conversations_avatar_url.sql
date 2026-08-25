-- Adds avatar_url to conversations, so a group chat (section or subject)
-- can have a custom logo, changeable by its professor(s)/mayor/officer.
-- Nullable and unused for direct conversations. Idempotent: IF NOT EXISTS
-- means a re-run is a safe no-op.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
