-- Records Terms & Conditions acceptance at the moment an account is
-- created (email/password registration, or first-time Google sign-up),
-- so consent is provable per-account instead of only enforced client-side.
-- Existing rows predate this requirement and never explicitly agreed
-- through this flow, so they are intentionally left as FALSE/NULL rather
-- than backfilled - nothing else in the app gates on this column, it is
-- an audit record only. Idempotent: IF NOT EXISTS means a re-run is a
-- safe no-op.
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP;
