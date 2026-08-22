-- Adds thumbnail_url to livestreams (backend/app/models/livestream.py already
-- declares Column(String(500), nullable=True) - the SQLAlchemy model was
-- updated for the Go Live thumbnail feature, but this table was never
-- altered to match, causing UndefinedColumnError on every livestream read).
--
-- Purely additive: nullable, no default needed, existing rows automatically
-- get NULL and keep working unchanged. IF NOT EXISTS makes this safe to
-- re-run. Same manual-run convention as the other files in this folder -
-- nothing in the app executes this automatically.
ALTER TABLE livestreams ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(500);
