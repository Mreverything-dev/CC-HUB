from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, posts, students, professors, profiles, sections, announcement, media, comments
from app.api.v1.endpoints import teaching_assignments
from app.api.v1.endpoints import chat, friends
from app.api.v1.endpoints import livestream
from app.api.v1.endpoints import admin
api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(posts.router, prefix="/posts", tags=["Posts"])
api_router.include_router(students.router, prefix="/students", tags=["Students"])
api_router.include_router(professors.router, prefix="/professors", tags=["Professors"])
api_router.include_router(profiles.router, prefix="/profiles", tags=["Profiles"])
api_router.include_router(sections.router, prefix="/sections", tags=["Sections"])
api_router.include_router(teaching_assignments.router, prefix="/teaching-assignments", tags=["Teaching Assignments"])
api_router.include_router(announcement.router, prefix="/announcements", tags=["Announcements"])
api_router.include_router(media.router, prefix="/media", tags=["Media"])
api_router.include_router(comments.router, prefix="/comments", tags=["Comments"])
api_router.include_router(chat.router, prefix="/chat", tags=["Chat"])
api_router.include_router(friends.router, prefix="/friends", tags=["Friends"])
api_router.include_router(
    livestream.router,
    prefix="/livestream",
    tags=["LiveStream"]
)