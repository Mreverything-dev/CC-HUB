# backend/app/schemas/notification.py
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional, List, Any, Dict
from datetime import datetime
import uuid

class NotificationResponse(BaseModel):
    id: str
    type: str
    title: Optional[str] = None
    content: Optional[str] = None
    is_read: bool = False
    data: Optional[Dict[str, Any]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator('id', mode='before')
    @classmethod
    def convert_uuid_to_str(cls, v):
        if isinstance(v, uuid.UUID):
            return str(v)
        return v

class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    unread_count: int
    total: int
