# backend/app/models/__init__.py
from app.models.user import User, Role, Permission
from app.models.profile import StudentProfile, ProfessorProfile, AdminProfile
from app.models.section import Section, SectionMember, SectionConversation
from app.models.teaching_assignment import TeachingAssignment, TeachingAssignmentConversation
from app.models.announcement import Announcement, AnnouncementTarget, AnnouncementReaction, AnnouncementBookmark
from app.models.post import Post, PostMedia, PostReaction
from app.models.comment import Comment, CommentReaction
from app.models.like import Like
from app.models.share import Share
from app.models.friend import Friend, FriendRequest, BlockedUser, UserReport
from app.models.conversation import Conversation, ConversationMember, Message, MessageReaction
from app.models.notification import Notification
from app.models.livestream import Livestream, StreamViewer, StreamComment, StreamCommentReaction
from app.models.meethub import MeethubSession, MeethubSpeakRequest, MeethubAttendanceRecord
from app.models.invitation_code import InvitationCode

__all__ = [
    "User",
    "Role",
    "Permission",
    "StudentProfile",
    "ProfessorProfile", 
    "AdminProfile",
    "Section",
    "SectionMember",
    "SectionConversation",
    "TeachingAssignment",
    "TeachingAssignmentConversation",
    "Post",
    "PostMedia",
    "PostReaction",
    "Comment",
    "CommentReaction",
    "Like",
    "Share",
    "Friend",
    "FriendRequest",
    "BlockedUser",
    "UserReport",
    "Announcement",
    "Message",
    "MessageReaction",
    "Conversation",
    "ConversationMember",
    "Notification",
    "Livestream",
    "StreamViewer",
    "StreamComment",
    "StreamCommentReaction",
    "MeethubSession",
    "MeethubSpeakRequest",
    "MeethubAttendanceRecord",
    "Announcement", "AnnouncementTarget", "AnnouncementReaction", "AnnouncementBookmark",
    "Report",
    "InvitationCode"
]