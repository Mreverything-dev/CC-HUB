# backend/app/schemas/report.py
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

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


class ConfirmViolationRequest(BaseModel):
    """The admin's own explanation of the violation - required, never the
    reporter's wording, shown verbatim to the reported user."""
    message: str = Field(..., min_length=1, max_length=2000)


class ViolationReportedPost(BaseModel):
    content: Optional[str] = None
    media_urls: List[str] = []
    exists: bool
    created_at: Optional[datetime] = None
    removed_by_moderation: bool = False


class ViolationRestriction(BaseModel):
    duration_label: str
    starts_at: datetime
    expires_at: datetime


class ViolationDetailResponse(BaseModel):
    """Everything the reported user's "Violation Details" view needs -
    deliberately excludes reporter_id/reporter_username/anything that could
    identify who filed the report."""
    report_id: str
    category: str
    category_label: str
    status: str
    reported_post: ViolationReportedPost
    admin_message: str
    moderation_actions: List[str]
    restriction: Optional[ViolationRestriction] = None
    reviewed_at: Optional[datetime] = None
