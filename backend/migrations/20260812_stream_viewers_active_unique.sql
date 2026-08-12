-- Deduplicate active viewer rows so only one active row remains per stream/user.
WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY stream_id, user_id
            ORDER BY joined_at ASC, id ASC
        ) AS rn
    FROM stream_viewers
    WHERE is_active IS TRUE
)
UPDATE stream_viewers sv
SET is_active = FALSE,
    left_at = COALESCE(left_at, CURRENT_TIMESTAMP)
FROM ranked
WHERE sv.id = ranked.id
  AND ranked.rn > 1;

-- Enforce one active viewer row per stream/user going forward.
CREATE UNIQUE INDEX IF NOT EXISTS uq_stream_viewers_active_stream_user
    ON stream_viewers (stream_id, user_id)
    WHERE is_active IS TRUE;
