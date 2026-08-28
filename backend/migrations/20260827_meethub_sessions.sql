-- Meethub tables (meethub_sessions, meethub_speak_requests,
-- meethub_attendance_records) are created by SQLAlchemy's
-- Base.metadata.create_all on backend startup once registered in
-- app/models/__init__.py. This migration only adds the partial unique
-- index create_all cannot express - same division of labor as
-- 20260812_stream_viewers_active_unique.sql.

CREATE UNIQUE INDEX IF NOT EXISTS uq_meethub_speak_requests_pending
    ON meethub_speak_requests (meethub_session_id, user_id)
    WHERE status = 'pending';
