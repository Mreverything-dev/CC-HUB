# backend/app/services/moderation_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from typing import Optional
from datetime import datetime, timedelta, timezone

from app.models.user import User
from app.models.post import Post
from app.models.friend import UserReport
from app.models.moderation import UserRestriction
from app.models.notification import Notification

RESTRICTION_DURATIONS = {
    "1d": timedelta(days=1),
    "1w": timedelta(days=7),
    "1m": timedelta(days=30),
}

_DURATION_LABEL = {"1d": "1 day", "1w": "7 days", "1m": "30 days"}

# What a reported post's category means for a human reading it back -
# the SAME slug is reused as UserReport.reason, this is purely a display
# label (no separate priority column/system - the "priority" tier below is
# computed here for the admin UI to sort/badge by, not stored anywhere).
CATEGORY_LABELS = {
    "bullying": "Bullying",
    "harassment": "Harassment",
    "abuse": "Abuse",
    "violent_content": "Violent Content",
    "adult_content": "Adult Content",
    "false_information": "False Information",
    "suicide_self_harm": "Suicide / Self-Harm",
}

# High-priority categories surface first in the admin queue - matches the
# task's own "Suicide/Self-Harm, Violent Content, Abuse, Harassment are
# high-priority" framing. Purely a computed sort/badge hint, not a stored
# column, since no priority system already exists for reports to plug into.
HIGH_PRIORITY_CATEGORIES = {"suicide_self_harm", "violent_content", "abuse", "harassment"}


class ModerationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ============================================
    # RESTRICTION STATE - the one source of truth every enforcement point
    # (REST dependency + WebSocket handlers) calls into.
    # ============================================

    async def get_active_restriction(self, user_id: str) -> Optional[UserRestriction]:
        """The user's current restriction, if any - "active" is never a
        stored flag, it's always computed by comparing restricted_until to
        right now, so a restriction expires automatically the instant that
        timestamp passes with no scheduled job or admin action needed. If a
        user has multiple still-active rows (admin restricted them more
        than once), the one that lasts longest wins."""
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(UserRestriction)
            .where(UserRestriction.user_id == user_id, UserRestriction.restricted_until > now)
            .order_by(UserRestriction.restricted_until.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def is_user_restricted(self, user_id: str) -> bool:
        return await self.get_active_restriction(user_id) is not None

    async def require_not_restricted(self, user_id: str) -> None:
        """Raise a 403 if the user currently has an active restriction -
        the shared check both the REST dependency and every WebSocket
        handler call before letting a social/interaction action through."""
        restriction = await self.get_active_restriction(user_id)
        if restriction:
            until = restriction.restricted_until.strftime("%b %d, %Y %I:%M %p UTC")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Your account is temporarily restricted from this action until {until}.",
            )

    # ============================================
    # REPORTING A POST (user-facing)
    # ============================================

    async def create_post_report(self, reporter_id: str, post_id: str, reason: str, details: Optional[str]) -> UserReport:
        post_result = await self.db.execute(select(Post).where(Post.id == post_id))
        post = post_result.scalar_one_or_none()
        if not post:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

        if str(post.user_id) == str(reporter_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot report your own post")

        report = UserReport(
            reporter_id=reporter_id,
            reported_id=post.user_id,
            post_id=post_id,
            reason=reason,
            details=details,
        )
        self.db.add(report)
        try:
            await self.db.commit()
        except IntegrityError:
            # The partial unique index on (reporter_id, post_id) - already reported this exact post.
            await self.db.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You've already reported this post")
        await self.db.refresh(report)
        return report

    # ============================================
    # ADMIN MODERATION ACTIONS
    # ============================================

    async def _get_report(self, report_id: str) -> UserReport:
        result = await self.db.execute(select(UserReport).where(UserReport.id == report_id))
        report = result.scalar_one_or_none()
        if not report:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
        return report

    async def dismiss_report(self, report_id: str, admin_id: str) -> UserReport:
        """Mark a report invalid - no restriction/warning is applied, and
        any action already taken on this report (e.g. an earlier warning)
        is left exactly as it happened, preserving history rather than
        reversing it."""
        report = await self._get_report(report_id)
        report.status = "dismissed"
        report.moderated_by = admin_id
        report.moderated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(report)
        return report

    async def validate_report(self, report_id: str, admin_id: str) -> UserReport:
        """Mark a report as a confirmed violation, with no further action
        yet - lets an admin record that judgment before deciding on a
        warning/restriction/removal separately."""
        report = await self._get_report(report_id)
        if report.status == "dismissed":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This report was already dismissed")
        report.status = "valid"
        report.moderated_by = admin_id
        report.moderated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(report)
        return report

    async def issue_warning(self, report_id: str, admin_id: str) -> UserReport:
        """Send the reported user a moderation-warning notification. Also
        marks the report valid (you can't warn someone over a report you
        haven't judged to be real) unless it was already dismissed."""
        report = await self._get_report(report_id)
        if report.status == "dismissed":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This report was already dismissed")

        report.status = "valid"
        report.warning_issued = True
        report.moderated_by = admin_id
        report.moderated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(report)

        await self._notify(
            user_id=str(report.reported_id),
            notif_type="moderation_warning",
            title="Moderation Warning",
            content=(
                "Your account has received a moderation warning because one of your "
                "posts was found to violate CCS HUB guidelines."
            ),
            data={"report_id": str(report.id)},
        )
        return report

    async def restrict_user(self, report_id: str, admin_id: str, duration: str) -> UserReport:
        """Apply a time-boxed social-interaction restriction to the
        reported user, linked back to this report for moderation history.
        Also marks the report valid, same reasoning as issue_warning."""
        if duration not in RESTRICTION_DURATIONS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid restriction duration")

        report = await self._get_report(report_id)
        if report.status == "dismissed":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This report was already dismissed")

        now = datetime.utcnow()
        restriction = UserRestriction(
            user_id=report.reported_id,
            reason=CATEGORY_LABELS.get(report.reason, report.reason),
            report_id=report.id,
            restricted_by=admin_id,
            restricted_at=now,
            restricted_until=now + RESTRICTION_DURATIONS[duration],
        )
        self.db.add(restriction)
        await self.db.flush()

        report.status = "valid"
        report.restriction_id = restriction.id
        report.moderated_by = admin_id
        report.moderated_at = now
        await self.db.commit()
        await self.db.refresh(report)

        label = _DURATION_LABEL[duration]
        await self._notify(
            user_id=str(report.reported_id),
            notif_type="moderation_restriction",
            title="Account Restricted",
            content=(
                f"Your account has been restricted for {label} due to a policy violation. "
                "During this period, you cannot post, comment, chat, like/react, or comment "
                "on livestreams. You can still view content and participate in livestreams "
                "and meetings."
            ),
            data={"report_id": str(report.id), "restricted_until": restriction.restricted_until.replace(tzinfo=timezone.utc).isoformat()},
        )
        return report

    async def remove_reported_post(self, report_id: str, admin_id: str) -> UserReport:
        """Delete the reported post - reuses PostService.delete_post (which
        already lets an admin delete any post) rather than a second
        deletion path, then records that this report ended in a removal."""
        from app.services.post_service import PostService

        report = await self._get_report(report_id)
        if report.post_id:
            post_service = PostService(self.db)
            try:
                await post_service.delete_post(str(report.post_id), admin_id)
            except HTTPException as e:
                if e.status_code != status.HTTP_404_NOT_FOUND:
                    raise
                # Already deleted (e.g. by the author) - fall through and
                # still record the moderation outcome on the report.

        report.post_removed = True
        report.status = "valid"
        report.moderated_by = admin_id
        report.moderated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(report)
        return report

    async def _notify(self, user_id: str, notif_type: str, title: str, content: str, data: dict) -> None:
        """Same DB-row-plus-realtime-push pattern every other notification
        in this app already uses (see AnnouncementService._notify_new_announcement) -
        `data` here is deliberately limited to non-identifying fields (report_id,
        restriction timing) - never the reporter's id/name/anything."""
        from app.websocket.manager import manager

        notification = Notification(user_id=user_id, type=notif_type, title=title, content=content, data=data)
        self.db.add(notification)
        await self.db.commit()
        await self.db.refresh(notification)

        await manager.send_to_user(
            user_id=user_id,
            event="new_notification",
            data={
                "id": str(notification.id),
                "type": notif_type,
                "title": title,
                "content": content,
                "data": data,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )
