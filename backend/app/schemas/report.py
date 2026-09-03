# backend/app/schemas/report.py
from pydantic import BaseModel, Field
from typing import Optional

# The seven structured report categories a user can pick when reporting a
# post. Stored directly in UserReport.reason (already a free-form string
# column used by the pre-existing user-report flow) rather than adding a
# parallel `category` column - this IS the category for a post report.
POST_REPORT_CATEGORIES = [
    "bullying",
    "harassment",
    "abuse",
    "violent_content",
    "adult_content",
    "false_information",
    "suicide_self_harm",
]

REPORT_CATEGORY_PATTERN = "^(" + "|".join(POST_REPORT_CATEGORIES) + ")$"


class PostReportCreate(BaseModel):
    reason: str = Field(..., pattern=REPORT_CATEGORY_PATTERN)
    details: Optional[str] = Field(None, max_length=1000)
