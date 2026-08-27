# CCS HUB Roadmap

## Project Overview

CCS HUB is a centralized web-based platform for the College of Computer
Studies that combines academic communication, section management,
announcements, messaging, social interaction, livestreaming, and
administration into a single hub for students, professors, and admins.

## Current Project Status

**Overall Progress: ~83%**

The project is currently transitioning from active feature development into
refinement, testing, and deployment preparation. Almost every core system
described below is functionally complete; the remaining work is concentrated
in automated testing, mobile QA, security review, and fixing known issues in
the deployment tooling.

The percentages below are **development estimates**, not measured metrics.

| Area | Estimate |
|---|---|
| Core Architecture | 95% |
| Authentication & Security | 95% |
| Section System | 95% |
| Professor System | 90% |
| Admin System | 90% |
| Announcements | 85% |
| Chat | 90% |
| Livestream | 90% |
| Social Feed | 85% |
| UI/UX | 88% |
| Mobile Responsiveness | 75% |
| Testing / QA | 20% |
| Deployment | 45% |

---

# ✅ Completed / Implemented

## Authentication & Security

- [x] Registration (email, username, password) with role selection
- [x] Email verification on registration, plus resend-verification
- [x] Login with JWT access + refresh tokens, role-based access control
- [x] Forgot password (emailed reset link)
- [x] Change password from Settings — validates the current password, then
      requires clicking an emailed confirmation link before the new password
      is applied (does not reuse the forgot-password flow's user-facing
      page, but reuses the same token/email architecture)
- [x] Password hashing via bcrypt (`passlib`); JWT via `python-jose`
- [x] Professor/Admin registration codes — single-use, expiring invitation
      codes, atomically consumed so a code can't be used twice in a race
- [x] Admin can generate and revoke invitation codes

## User & Profile System

- [x] Role-specific profiles (Student, Professor, Admin) with their own
      fields (e.g. student ID/course/year level; employee ID/department;
      admin position)
- [x] Profile editing
- [x] Avatar upload (stored in MinIO)
- [x] Profile page with posts/shares/saved/about tabs, plus a Security tab
      (change password) on your own profile
- [x] Clickable profile navigation from avatars/usernames throughout the app
      (posts, chat, sections, livestream, admin tools)
- [x] "Live" indicator on a user's avatar while they are actively streaming

## Section Management

- [x] Create a section; join an existing section (by year level)
- [x] **Multiple professors per section**, each with their own **Teaching
      Assignment** (subject, subject code, room, schedule days/time)
- [x] Automatic schedule-conflict checking when a professor adds a subject
- [x] Mayor and Officer roles (promote/demote, single-holder invariants)
- [x] Add student to a section; student search
- [x] "What's your real name?" prompt for a newly invited student whose
      profile name is still blank
- [x] Section-scoped announcements and posts
- [x] **Section group chat**, auto-created and kept in sync with membership
- [x] **Subject group chat** — a separate group chat per Teaching Assignment,
      named `"{Section Name} {Subject Code}"`, auto-created and kept in sync
- [x] Group chat members list (avatar, name, Professor/Mayor/Officer/Student
      role) and a professor/mayor/officer-only group logo upload

## Professor / Teaching Assignments

- [x] "My Teaching Assignments" hub — grid of sections with stats
      (sections, subjects, total hours, total students)
- [x] Add a subject to a section already taught; edit or remove a subject
- [x] Join another existing section
- [x] Create a new section (with an optional first subject/schedule)
- [x] Weekly Classes/Schedule page (shared with students) showing a
      day-by-day timetable with subject code, room, and section/professor
- [x] Student Directory / search within a section

> **Note:** Attendance and Violations UI exists as read-only, honestly-empty
> placeholders (`StudentRecordModal.tsx`) — there is intentionally no backend
> for either yet. See [Future Enhancements](#-future-enhancements).

## Announcements

- [x] Create, edit, delete announcements
- [x] Section-targeted and admin/global visibility
- [x] Reactions (emoji) and bookmarks
- [x] Announcement feed and a dedicated detail page
- [x] Category/type sidebar (e.g. "Popular Announcements")

## Social Feed

- [x] Posts with text and media (images/videos), stored via MinIO
- [x] Likes and multi-emoji reactions
- [x] Comments (with replies) and comment reactions
- [x] Sharing a post
- [x] Post detail modal, dashboard feed, and profile-scoped post lists
- [x] Real-time delivery of reactions/comments where wired through sockets

## Chat

- [x] Direct messaging between two users
- [x] Section and Subject group chats (see Section Management above)
- [x] Real-time delivery over Socket.IO — typing indicators, read receipts
- [x] Emoji reactions on messages
- [x] Image/video/file attachments in chat
- [x] "Message Professor" / "Message Student" entry points from sections,
      classes, and livestream viewer lists
- [x] Floating chat widget available from anywhere in the app, plus a full
      chat page

## Livestreaming

- [x] Go Live setup — camera, screen/window share, camera-in-corner (PiP)
      compositing, independent microphone control, thumbnail upload
- [x] WebRTC host/viewer streaming over the existing Socket.IO signaling
- [x] Live chat, reactions, and viewer count during a stream
- [x] Viewer list with avatar/name and Professor/Mayor/Officer/Student roles
- [x] Automatic thumbnail capture from the live video when the host doesn't
      upload one
- [x] Minimize a livestream into a small picture-in-picture widget and keep
      browsing the rest of CCS HUB while it keeps playing
- [x] Live streams surfaced on the dashboard (widget) and a dedicated
      Livestreams browse page
- [x] Auto-hide player controls, fullscreen, volume control, live duration
      display, streamer avatar/name on the player

## Admin Dashboard

- [x] User management — list, search, and filter by role/status
- [x] Manually create a user account
- [x] Suspend / reactivate a user account
- [x] Professor/Admin invitation code generation, listing, and deletion
      (single-use, expiring)
- [x] Role and permission seeding runs automatically on backend startup,
      including a superadmin account from environment variables

## UI/UX

- [x] Consistent dark charcoal/glassmorphism theme across Login, Register,
      Dashboards (Student/Professor/Admin), Profile, Sections, Teaching
      Assignments, Announcements, Posts, Chat, Livestream, and Admin/User
      Management
- [x] Global search (people, posts, announcements, sections) from the top bar
- [x] Mobile-responsive navigation (collapsible sidebar drawer, mobile search)
- [x] Redesigned Classes/Schedule page as a clean weekly timetable

---

# 🟡 In Progress

- [ ] Cross-feature integration testing (chat + sections + livestream
      interactions under real usage)
- [ ] Mobile responsiveness QA pass across every feature (most screens have
      been built responsively, but a full device/browser pass hasn't been
      done)
- [ ] Final UI consistency polish (a few older screens still differ slightly
      in spacing/detail from the latest redesigns)
- [ ] Realtime reaction/notification testing under concurrent multi-user load

---

# 🔵 Pending / Next Development

### High Priority
- [ ] Authentication edge-case testing (expired/reused tokens, concurrent
      password-change confirmations, invitation-code race conditions)
- [ ] Realtime feature testing (chat, livestream signaling, notifications)
      under real network conditions
- [ ] Mobile device testing (not just responsive layout — touch interactions,
      livestream controls, chat widget)
- [ ] Security review (see [Phase 2](#phase-2--security) below)
- [ ] Error-handling review across API failure paths
- [ ] Fix the known issues in `docker-compose.yml` (duplicate/misplaced
      `minio` service block) and `database/init.sql` (out of date vs. the
      real schema) before relying on the Docker setup path

### Medium Priority
- [ ] Performance optimization (bundle size — the production build currently
      exceeds Vite's 500kB chunk-size warning threshold)
- [ ] Database query optimization for high-traffic endpoints (feed, sections)
- [ ] Loading-state and empty-state consistency review
- [ ] Notification system refinement (delivery consistency, read/unread state)
- [ ] UI consistency review across older vs. newly redesigned pages

### Low Priority
- [ ] Minor visual polish and micro-animations
- [ ] Additional convenience/UX refinements based on pilot feedback

---

# 🚀 Deployment Roadmap

## Phase 1 — Development Complete
- [x] Core authentication, sections, teaching assignments, chat, feed,
      announcements, livestream, and admin systems implemented
- [ ] Remaining bugs from the in-progress list above fixed
- [ ] Cross-feature integration testing complete

## Phase 2 — Security
- [ ] Review authentication and token-expiry edge cases
- [ ] Review authorization/permission checks on every endpoint
- [ ] Secure and rotate all environment variables/secrets (`SECRET_KEY`,
      database, SMTP, MinIO credentials all currently use development
      placeholders)
- [ ] Configure production CORS (the current config permissively allows
      private-LAN origins, which is a development convenience only)
- [ ] Review password/token security end to end
- [ ] Review file upload validation (type/size limits already exist —
      confirm they're sufficient for production)

## Phase 3 — Testing
- [ ] Student flow testing
- [ ] Professor flow testing
- [ ] Admin flow testing
- [ ] Realtime (chat/livestream/notifications) testing
- [ ] Mobile testing
- [ ] Cross-browser testing
- [ ] Email delivery testing (verification, forgot-password, change-password
      confirmation)
- [ ] Database testing under realistic data volume
- [ ] Write actual automated tests — `backend/app/tests/` currently only has
      a `conftest.py`, no test modules; the frontend's `npm test` script is a
      placeholder stub

## Phase 4 — Deployment
- [ ] Configure a VPS/server
- [ ] Configure production PostgreSQL
- [ ] Configure production Redis
- [ ] Configure production environment variables
- [ ] Configure a domain and HTTPS
- [ ] Configure the frontend build/serve pipeline
- [ ] Configure FastAPI for production (disable `DEBUG`, restrict `DEBUG`
      docs if desired)
- [ ] Configure WebSocket forwarding through the production reverse proxy
- [ ] Configure the production email service
- [ ] Configure database backups

## Phase 5 — Pilot Testing
- [ ] Deploy a test version
- [ ] Invite a small group of students
- [ ] Invite participating professors
- [ ] Collect feedback
- [ ] Fix reported issues
- [ ] Final release

---

# 🔮 Future Enhancements

**Future / Optional** — not required for the current MVP:

- Attendance tracking (no backend exists yet; only an intentionally-empty
  UI placeholder is present today)
- Student violations/discipline tracking (same status as Attendance)
- Advanced notification system (categorization, preferences)
- Academic performance dashboard / advanced analytics
- Advanced admin reports
- Push notifications (mobile)
- Progressive Web App / native mobile app
- Advanced full-text search
- Additional livestream capabilities (recording history, scheduled streams
  browsing beyond what exists today)
- Additional moderation tools (the `Report`/`UserReport` model exists for
  user-to-user reporting, but there is no admin moderation queue/workflow
  built on top of it yet)
- Advanced content management tools
- System-wide usage analytics
- Backup/restore management tooling
- AI features (chatbot, content recommendations) — not started, no code
  exists for this today

---

# 📊 Progress Summary

| Area | Status | Progress |
|---|---|---|
| Core Architecture | Completed | 95% |
| Authentication | Completed | 95% |
| Section System | Completed | 95% |
| Professor System | Completed | 90% |
| Admin System | Completed | 90% |
| Announcements | Completed | 85% |
| Chat | Completed | 90% |
| Livestream | Completed | 90% |
| Social Feed | Completed / Refinement | 85% |
| UI/UX | Refinement | 88% |
| Mobile | Refinement | 75% |
| Testing / QA | Early | 20% |
| Deployment | Pending | 45% |

These are **development estimates only**, not measured metrics.

**Overall: ~83% Complete**

> CCS HUB has completed most of its major functional systems and is
> currently transitioning from feature development into testing,
> refinement, security review, and deployment preparation.

---

# 🎯 Current Development Focus

1. Finish remaining in-progress polish items
2. Fix the known `docker-compose.yml` / `database/init.sql` issues
3. Write automated backend and frontend tests
4. Test authentication edge cases (token expiry, reused/expired
   confirmation links)
5. Test realtime features (chat, livestream, notifications) under load
6. Complete a full mobile responsiveness/device QA pass
7. Perform a security review (secrets, CORS, permissions, uploads)
8. Prepare the production environment and deployment configuration
9. Deploy to a VPS
10. Conduct pilot testing with real students and professors
