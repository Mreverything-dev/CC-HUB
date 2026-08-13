# backend/app/core/db_types.py
"""Shared timestamp handling for the whole app.

Every timestamp column in Postgres here is TIMESTAMP WITHOUT TIME ZONE
(left as-is deliberately - no migration, no risk to existing data), and
every row has always been written with datetime.utcnow() - so the stored
wall-clock value has always MEANT UTC, it just was never labeled as such.
That mislabeling is the root of the "8 hours ago" bug: a naive datetime
serializes to JSON with no timezone marker, and the browser's Date parser
then reads it as local time instead of UTC, creating a phantom UTC+8 gap
for Manila users.

UTCDateTime fixes this at the one point every timestamp enters or leaves
the database, without changing the column type or touching existing rows:
 - Reading a row: attaches UTC tzinfo to the naive value the driver
   returns, so every ORM attribute is timezone-aware from here on - which
   makes Pydantic (and any manual .isoformat()/dict) serialize it with an
   explicit "+00:00"/"Z", so the browser parses it correctly.
 - Writing a row: accepts a naive datetime (assumed UTC, matching every
   existing datetime.utcnow() call site) or an aware datetime (converted
   to UTC first), then strips tzinfo before handing it to the naive
   TIMESTAMP column - so on-disk values are unchanged.

Use Column(UTCDateTime) instead of Column(DateTime) in every model.
"""
from datetime import datetime, timezone
from sqlalchemy import DateTime
from sqlalchemy.types import TypeDecorator


class UTCDateTime(TypeDecorator):
    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect):
        if value is None:
            return None
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc)
        return value.replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect):
        if value is None:
            return None
        return value.replace(tzinfo=timezone.utc)
