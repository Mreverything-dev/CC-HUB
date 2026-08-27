# CCS HUB

CCS HUB is a web platform built for a College of Computer Studies that combines a
campus social feed, academic section/class management, real-time chat, and
livestreaming into a single app for students, professors, and admins.

The backend is a FastAPI (Python) service backed by PostgreSQL, with real-time
features (chat, livestream signaling, live notifications) over Socket.IO. The
frontend is a React + TypeScript single-page app built with Vite.

This guide walks a developer through setting up CCS HUB **from a completely new
PC** — installing prerequisites, configuring the database/cache/email, and
running both the backend and frontend locally.

---

## Features

Based on what is actually implemented in this repository:

- **Role-based accounts** — Student, Professor, and Admin roles, with
  invitation-code-gated registration for Professor/Admin accounts.
- **Email verification** on registration, plus **resend verification**.
- **Forgot password** (email link) and **change password from Settings**
  (current password + email confirmation link before the change takes effect).
- **Sections** — create/join sections, promote Mayor/Officer roles, and
  **multiple professors per section**, each teaching **multiple subjects**
  (Teaching Assignments) with their own schedule (days, time, subject code,
  room).
- **Classes / Schedule page** — a weekly timetable view built from a
  professor's or student's teaching assignments.
- **Social feed** — posts with reactions, comments, shares, and media
  attachments.
- **Announcements** with role/section-targeted visibility.
- **Real-time chat** — direct messages, plus **auto-created Section and
  Subject group chats** (with a members list and a professor/mayor/officer
  -only group logo), typing indicators, reactions, and file/image/video
  attachments — all over Socket.IO.
- **Friends system** — requests, suggestions, and blocking.
- **Notifications** for friend requests, announcements, etc.
- **Livestreaming** — WebRTC host/viewer streaming, screen sharing with
  camera picture-in-picture, live chat and reactions, viewer list, and
  automatic thumbnail capture when the host doesn't upload one.
- **Admin dashboard** — user management and professor/admin invitation codes.
- **Media uploads** (images, videos, documents, avatars, thumbnails, group
  logos) stored in **MinIO** (S3-compatible object storage).
- **Auto-seeded superadmin account** — created automatically the first time
  the backend starts, from credentials you provide in `.env` (see
  [Default Accounts](#default-accounts)).

---

## Technology Stack

### Frontend (`frontend/`)
| Technology | Version (from `package.json`) | Purpose |
|---|---|---|
| React | ^19.0.0 | UI framework |
| TypeScript | ^5.2.2 | Type safety |
| Vite | ^5.0.0 | Dev server / build tool |
| React Router | ^6.20.0 | Routing |
| TanStack Query | ^5.8.4 | Server-state data fetching |
| Zustand | ^4.4.7 | Client state management |
| Axios | ^1.6.0 | HTTP client |
| Tailwind CSS | ^3.3.6 | Styling |
| Socket.IO Client | ^4.8.3 | Real-time chat/livestream/notifications |
| React Hook Form + Zod | ^7.48.2 / ^3.22.4 | Forms & validation |
| Framer Motion | ^13.0.0 | Animations |
| Chart.js / react-chartjs-2 | ^4.4.0 / ^5.2.0 | Charts |

### Backend (`backend/`)
| Technology | Version (from `requirements.txt`) | Purpose |
|---|---|---|
| FastAPI | 0.104.1 | API framework |
| Python | 3.11+ (see [System Requirements](#system-requirements)) | Language runtime |
| SQLAlchemy (async) | 2.0.23 | ORM |
| PostgreSQL driver | `psycopg2-binary` 2.9.9 (sync) + `asyncpg` (async, used at runtime — see note below) | Database driver |
| Pydantic / pydantic-settings | 2.5.0 / 2.1.0 | Data validation & settings |
| python-jose | 3.3.0 | JWT access/refresh tokens |
| passlib[bcrypt] | 1.7.4 | Password hashing |
| python-socketio | 5.10.0 | Real-time WebSocket layer |
| MinIO (`minio` client) | 7.2.0 | Object storage for uploaded media |
| fastapi-mail (used at runtime — see note below) | — | Sending verification/reset/notification emails |
| Redis (`redis` client) | 5.0.1 | Token storage (email verification / password reset / password change confirmation) |
| Pillow | 10.1.0 | Image handling |

> **Note on `requirements.txt`:** the file does not list `fastapi-mail`,
> `jinja2`, or `asyncpg`, even though `backend/app/services/email_service.py`
> imports `fastapi_mail`/`jinja2` and `backend/app/core/database.py` connects
> using the `asyncpg` driver. These packages **are required** for the backend
> to start and to send email. [Step 3](#step-3--set-up-the-backend) below
> installs them explicitly in addition to `requirements.txt`.

### Database & Cache
- **PostgreSQL** — primary database (async, via SQLAlchemy + `asyncpg`).
- **Redis** — used to store short-lived tokens (email verification, forgot
  password, and the change-password email-confirmation flow). Not used as a
  general cache beyond that in this codebase.

### Other infrastructure present in the repo
- **Celery** (`celery` package, `backend/app/workers/celery_app.py`) is
  configured but **not required** — nothing in the current codebase enqueues
  a Celery task (all emails are sent directly, in-request, via
  `fastapi-mail`). The Celery app also references
  `app.workers.tasks.email_tasks` / `app.workers.tasks.notification_tasks`,
  which do not exist in this repository, so **do not attempt to start the
  `celery_worker` Docker service** — it will fail to import. You can safely
  ignore Celery/Docker's `celery_worker` service for local development.
- **Docker / docker-compose** files exist (`docker-compose.yml`,
  `docker-compose.dev.yml`, `backend/Dockerfile`, `backend/Dockerfile.dev`,
  `frontend/Dockerfile`) but are **not the verified setup path** for this
  guide — see the callout in [Installation](#installation) for known issues
  with them. This guide documents the manual setup, which is what this
  project actually runs on.

---

## System Requirements

Only versions actually confirmed by the repository's own config files:

| Requirement | Version | Source |
|---|---|---|
| Node.js | 18+ (repo's own `frontend/Dockerfile` uses `node:18-alpine`) | `frontend/Dockerfile` |
| npm | Whatever ships with your Node.js install (repo uses a `package-lock.json`, i.e. npm, not yarn/pnpm) | `frontend/package-lock.json` |
| Python | 3.11+ (`pyproject.toml` pins `python = "^3.11"`, `backend/Dockerfile` uses `python:3.11-slim`) — this repo's own backend has also been run successfully on newer Python 3.x | `backend/pyproject.toml`, `backend/Dockerfile` |
| PostgreSQL | 15 (`docker-compose.yml` uses `postgres:15-alpine`) | `docker-compose.yml` |
| Redis | 7 (`docker-compose.yml` uses `redis:7-alpine`) | `docker-compose.yml` |
| MinIO | Latest (`docker-compose.yml` uses `minio/minio:latest`) — required for media uploads to work | `docker-compose.yml` |
| Git | Any recent version | — |
| OS | No OS-specific code found; instructions below work on Windows, macOS, and Linux | — |

---

## Project Structure

```
CCS_HUB/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── main.py          # App entry point (FastAPI + Socket.IO)
│   │   ├── core/            # Settings, DB engine, security (JWT/hashing)
│   │   ├── api/v1/          # API routers (endpoints/*.py), mounted at /api/v1
│   │   ├── models/          # SQLAlchemy models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # Business logic per feature
│   │   ├── websocket/       # Socket.IO event handlers
│   │   ├── storage/         # MinIO client wrapper
│   │   ├── templates/email/ # HTML email templates (Jinja2)
│   │   ├── seed/            # Auto-seeds permissions/roles/superadmin on startup
│   │   └── tests/           # pytest tests (see Development Commands)
│   ├── migrations/          # Hand-written, manually-run SQL migration files
│   │                        # (there is no Alembic migration history in this
│   │                        #  repo, despite alembic being a listed dependency)
│   ├── requirements.txt     # Primary dependency list (see note above)
│   ├── pyproject.toml       # Poetry-equivalent dependency list (kept in sync)
│   └── .env                 # Your local backend config (you create this)
├── frontend/                 # React + Vite application
│   ├── src/
│   │   ├── features/         # Feature-organized UI (auth, chat, posts, ...)
│   │   ├── lib/               # axios client, socket client, formatters
│   │   ├── services/api/      # Typed API call wrappers
│   │   └── App.tsx            # Route definitions
│   ├── package.json
│   └── .env / .env.example    # Your local frontend config
├── database/
│   └── init.sql              # Postgres init script used by docker-compose only
│                              # (see note in Step 5 — it is out of date)
├── docker-compose.yml         # Not the verified setup path — see notes below
├── docker-compose.dev.yml
├── nginx/, monitoring/, docs/, scripts/  # Ops/CI scaffolding, not needed for local dev
└── README.md
```

---

## Installation

This guide uses the **manual setup** (Python venv + npm, direct PostgreSQL/
Redis/MinIO installs). This is the path this repository is actually
developed and run on.

> **About Docker:** `docker-compose.yml` and `docker-compose.dev.yml` exist
> in the repo, but two real issues were found in them during this review:
> 1. `docker-compose.yml` has a duplicate/misplaced `minio:` service block
>    nested under its `volumes:` section — fix that indentation before
>    trusting `docker-compose up` with it.
> 2. `database/init.sql` (mounted into the Postgres container on first boot)
>    only creates two tables (`users`, `student_profiles`) with a schema that
>    no longer matches the application's real, much larger SQLAlchemy schema
>    (sections, posts, chat, livestreams, teaching assignments, etc. are all
>    missing from it). The application itself creates the full, correct
>    schema automatically on startup (see [Step 6](#step-6--database-setup)),
>    so if you use Docker for Postgres, either drop the `init.sql` volume
>    mount or drop/recreate the database after the backend's own table
>    creation runs.
>
> Because of this, the step-by-step guide below sets up PostgreSQL, Redis,
> and MinIO directly rather than through Docker.

### Step 1 — Install Prerequisites

Install on your new PC:

1. **Git** — <https://git-scm.com/downloads>
2. **Node.js 18+** (includes npm) — <https://nodejs.org/>
3. **Python 3.11+** — <https://www.python.org/downloads/>
4. **PostgreSQL 15** — <https://www.postgresql.org/download/>
5. **Redis 7** — on Windows, use [Memurai](https://www.memurai.com/) or WSL;
   on macOS, `brew install redis`; on Linux, your package manager.
6. **MinIO** (or another S3-compatible server) — required for media/file
   uploads to work. See [Step 7](#step-7--minio-object-storage).

Verify installs:
```bash
git --version
node --version
npm --version
python --version
psql --version
redis-cli --version
```

### Step 2 — Clone Repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd CCS_HUB
```
(The actual repository URL could not be determined from within the repository
itself — use whatever Git remote you push/pull this project from.)

### Step 3 — Set Up the Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install the listed dependencies
pip install -r requirements.txt

# Install the additional packages the code imports but requirements.txt
# does not list (see the Technology Stack note above)
pip install fastapi-mail jinja2 asyncpg
```

(Alternative: if you prefer Poetry, `backend/pyproject.toml` lists the same
dependencies — `pip install poetry && poetry install`, then prefix commands
with `poetry run`. It has the same `fastapi-mail`/`jinja2`/`asyncpg` gap, so
`poetry add fastapi-mail jinja2 asyncpg` as well.)

### Step 4 — Environment Variables

Create `backend/.env`. There is a `.env.example` at the repository root, but
it is **incomplete** for this codebase (it is missing the email/SMTP
variables and the two required superuser variables below) — use the full
variable reference in [Environment Variables](#environment-variables)
instead of copying `.env.example` as-is.

At minimum, `backend/.env` must define:

```env
# Required - the backend will fail to start without these two
FIRST_SUPERUSER_EMAIL=
FIRST_SUPERUSER_PASSWORD=

# Database (Step 5)
DATABASE_URL=postgresql://<db_user>:<db_password>@localhost:5432/ccs_hub

# Redis (Step 6)
REDIS_URL=redis://localhost:6379/0

# Security - generate your own random value, do not use the repo's default
SECRET_KEY=

# Frontend URL - used to build links inside emails
FRONTEND_URL=http://localhost:3000

# Email/SMTP (Step 8)
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM=
MAIL_FROM_NAME=CCS HUB
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
MAIL_STARTTLS=True
MAIL_SSL_TLS=False

# MinIO (Step 7)
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_BUCKET=ccs-hub
MINIO_SECURE=False
```

Never commit real values for these — see [Security Notes](#security-notes).

### Step 5 — PostgreSQL

1. Install PostgreSQL (Step 1) and make sure the server is running.
2. Create a database and a role for the app, e.g. (via `psql`):
   ```sql
   CREATE USER ccs_user WITH PASSWORD 'choose-a-password';
   CREATE DATABASE ccs_hub OWNER ccs_user;
   ```
3. Set `DATABASE_URL` in `backend/.env` to match exactly what you created:
   ```env
   DATABASE_URL=postgresql://ccs_user:choose-a-password@localhost:5432/ccs_hub
   ```
   `backend/app/core/database.py` rewrites this at runtime from
   `postgresql://` to `postgresql+asyncpg://` automatically — always write
   `DATABASE_URL` starting with plain `postgresql://` in `.env`.
4. No PostgreSQL extensions are required by the application models
   themselves (UUID primary keys are generated in Python, not via a Postgres
   extension function).

### Step 6 — Database Setup

This project has **no Alembic migration history** (no `alembic.ini` or
`alembic/` folder exists, even though `alembic` is a listed dependency).
Schema creation works like this instead:

1. **Automatic table creation.** The first time the backend starts
   (`backend/app/main.py`'s `lifespan`), it runs
   `Base.metadata.create_all(...)` against your database, creating every
   table for every model in `backend/app/models/` if it doesn't already
   exist. You do not run a separate "migrate" command for this — just start
   the backend (Step 9).
2. **Automatic seeding.** Immediately after table creation, the same startup
   hook runs `app/seed/seed_all()`, which seeds permissions, roles, and a
   superadmin user (from `FIRST_SUPERUSER_EMAIL`/`FIRST_SUPERUSER_PASSWORD`)
   — see [Default Accounts](#default-accounts). This also runs automatically
   on every startup; it's a no-op if the admin account already exists.
3. **Manual one-off migrations.** `backend/migrations/*.sql` contains a
   handful of hand-written `ALTER TABLE` scripts for schema changes made
   after a table already existed in developers' databases (e.g. adding a
   column). These are **not run automatically** — apply them yourself with
   `psql` (in filename/date order) only if your database already existed
   before these files were added:
   ```bash
   psql -U ccs_user -d ccs_hub -f backend/migrations/20260812_stream_viewers_active_unique.sql
   psql -U ccs_user -d ccs_hub -f backend/migrations/20260817_teaching_assignments_backfill.sql
   psql -U ccs_user -d ccs_hub -f backend/migrations/20260820_livestreams_thumbnail_url.sql
   psql -U ccs_user -d ccs_hub -f backend/migrations/20260824_teaching_assignments_subject_code_room.sql
   psql -U ccs_user -d ccs_hub -f backend/migrations/20260825_conversations_avatar_url.sql
   ```
   If you are starting from a brand-new, empty database, `create_all` in
   step 1 already creates every column these scripts would add, so this step
   is not required for a fresh install — only for upgrading an existing one.

### Step 7 — MinIO (Object Storage)

MinIO is required for uploads (post media, avatars, thumbnails, chat
attachments, group chat logos) to work — `backend/app/api/v1/endpoints/media.py`
uploads directly to it.

1. Install/run MinIO locally. The simplest option is the official MinIO
   server binary or Docker image, run standalone (not via this repo's
   `docker-compose.yml`, to avoid its unrelated issues noted above):
   ```bash
   docker run -p 9000:9000 -p 9001:9001 \
     -e MINIO_ROOT_USER=minioadmin \
     -e MINIO_ROOT_PASSWORD=minioadmin \
     minio/minio server /data --console-address ":9001"
   ```
   (Or install the native MinIO server binary if you'd rather not use
   Docker at all — see <https://min.io/docs/minio/linux/index.html>.)
2. Open the MinIO console (`http://localhost:9001`) and create a bucket
   matching `MINIO_BUCKET` in your `.env` (default `ccs-hub`).
3. Set the matching values in `backend/.env`:
   ```env
   MINIO_ENDPOINT=localhost:9000
   MINIO_ACCESS_KEY=minioadmin
   MINIO_SECRET_KEY=minioadmin
   MINIO_BUCKET=ccs-hub
   MINIO_SECURE=False
   ```

### Step 8 — Redis

Redis is required — it backs the email-verification, forgot-password, and
change-password-confirmation token flows (`backend/app/services/redis_service.py`).

1. Install and start Redis (Step 1).
2. Verify it's running:
   ```bash
   redis-cli ping
   # should print: PONG
   ```
3. Set in `backend/.env`:
   ```env
   REDIS_URL=redis://localhost:6379/0
   ```

### Step 9 — Email (SMTP) Configuration

CCS HUB sends real emails for: registration verification, resending
verification, forgot-password, and change-password confirmation
(`backend/app/services/email_service.py`, using `fastapi-mail`).

You need SMTP credentials from a real provider. For Gmail, this means an
[App Password](https://support.google.com/accounts/answer/185833) (not your
normal Gmail password), since Gmail blocks plain-password SMTP login.

Set in `backend/.env`:
```env
MAIL_USERNAME=your-smtp-username-or-email
MAIL_PASSWORD=your-smtp-app-password
MAIL_FROM=your-sending-address@example.com
MAIL_FROM_NAME=CCS HUB
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
MAIL_STARTTLS=True
MAIL_SSL_TLS=False
```
If you use a different provider, set `MAIL_SERVER`/`MAIL_PORT` to that
provider's SMTP host/port instead. Never commit real values for these.

### Step 10 — Start the Backend

From `backend/`, with the virtual environment active and `.env` fully filled
in:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

This is the exact command from `backend/app/main.py`'s own
`if __name__ == "__main__"` block / its module docstring comment. On
startup it will create tables and seed the superadmin (Steps 6).

- Backend base URL: `http://localhost:8000`
- API base path: `http://localhost:8000/api/v1`
- Interactive API docs (Swagger UI): `http://localhost:8000/api/docs`
- ReDoc: `http://localhost:8000/api/redoc`
- Health check: `http://localhost:8000/health`

### Step 11 — Set Up the Frontend

In a second terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env` (there is a real, usable `frontend/.env.example` you
can copy):
```bash
cp .env.example .env
```
Its contents:
```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000
VITE_APP_NAME=CCS HUB
```
Both `VITE_API_URL` and `VITE_WS_URL` are actually **optional** —
`frontend/src/lib/axios.ts` and `frontend/src/lib/socket.ts` fall back to
`http://<the hostname you loaded the page from>:8000` if they're unset,
which is what makes LAN/mobile access (Step 13) work without editing this
file per device.

Start the dev server:
```bash
npm run dev
```
This runs `vite --host` (from `frontend/package.json`'s `dev` script),
which binds to all network interfaces, not just `localhost`.

- Frontend URL: `http://localhost:3000` (port set in `frontend/vite.config.ts`)

### Step 12 — How the Frontend Talks to the Backend

- **REST API**: `frontend/src/lib/axios.ts` calls `VITE_API_URL`, or falls
  back to `http://<page hostname>:8000/api/v1`.
- **WebSocket**: `frontend/src/lib/socket.ts` connects to `VITE_WS_URL` (or
  the same hostname fallback) using Socket.IO path `/ws/socket.io`, which
  matches `backend/app/main.py`'s `socketio.ASGIApp(..., socketio_path="ws/socket.io")`.
- **CORS**: the backend's `CORS_ORIGINS` env var (default
  `http://localhost:3000,http://localhost:5173`) plus a regex
  (`CORS_ORIGIN_REGEX` in `backend/app/core/config.py`) that additionally
  allows any private-LAN IP (`192.168.x.x`, `10.x.x.x`, `172.16-31.x.x`) on
  ports 3000/5173 — this is what lets a phone on the same Wi-Fi reach the
  API without extra config.

If frontend and backend are on the same machine with default ports, there is
nothing else to configure.

### Step 13 — Open CCS HUB

- **Frontend (the app)**: <http://localhost:3000>
- **Backend API**: <http://localhost:8000/api/v1>
- **API docs**: <http://localhost:8000/api/docs>

**From another device on the same Wi-Fi/LAN** (e.g. a phone), find your
computer's local IP address (`ipconfig` on Windows / `ifconfig` or `ip addr`
on macOS/Linux) and visit `http://<your-computer-LAN-IP>:3000`. This works
out of the box because:
- `vite --host` binds the frontend to all interfaces,
- the frontend's own API/WebSocket URL fallbacks derive from whatever
  hostname the page was loaded from, and
- the backend's `CORS_ORIGIN_REGEX` explicitly allows private-LAN origins.

You'll need to start the backend with `--host 0.0.0.0` (already shown in
Step 10) so it also accepts connections from other devices, not just
`localhost`.

---

## Environment Variables

All variables read by `backend/app/core/config.py`'s `Settings` class. "Has a
default" means the app will still start without it in `.env`; the two marked
Required have **no default** and the app will fail to start without them.

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `FIRST_SUPERUSER_EMAIL` | **Required** | Email of the auto-seeded superadmin account | `admin@yourdomain.com` |
| `FIRST_SUPERUSER_PASSWORD` | **Required** | Password for that account (hashed before storing) | `choose-a-strong-password` |
| `DATABASE_URL` | Has a default (points at a DB that won't exist on a new PC — set your own) | PostgreSQL connection string | `postgresql://ccs_user:pass@localhost:5432/ccs_hub` |
| `DATABASE_ECHO` | Optional | Log all SQL statements | `False` |
| `DATABASE_POOL_SIZE` | Optional | SQLAlchemy connection pool size | `20` |
| `DATABASE_MAX_OVERFLOW` | Optional | Extra connections beyond pool size | `40` |
| `DATABASE_POOL_TIMEOUT` | Optional | Seconds to wait for a pooled connection | `30` |
| `MAIL_USERNAME` | Required for email features to work | SMTP username | `you@gmail.com` |
| `MAIL_PASSWORD` | Required for email features to work | SMTP password/app password | *(never commit)* |
| `MAIL_FROM` | Has a default | "From" address on sent emails | `noreply@yourdomain.com` |
| `MAIL_FROM_NAME` | Optional | Display name on sent emails | `CCS HUB` |
| `MAIL_PORT` | Optional | SMTP port | `587` |
| `MAIL_SERVER` | Optional | SMTP host | `smtp.gmail.com` |
| `MAIL_STARTTLS` | Optional | Use STARTTLS | `True` |
| `MAIL_SSL_TLS` | Optional | Use implicit SSL/TLS instead | `False` |
| `USE_CREDENTIALS` | Optional | Whether to authenticate to the SMTP server | `True` |
| `VALIDATE_CERTS` | Optional | Validate the SMTP server's TLS cert | `True` |
| `REDIS_URL` | Has a default | Redis connection string | `redis://localhost:6379/0` |
| `VERIFICATION_TOKEN_EXPIRE_MINUTES` | Optional | Email verification token lifetime | `60` |
| `FRONTEND_URL` | Has a default | Used to build links inside emails | `http://localhost:3000` |
| `SECRET_KEY` | Has an insecure default — **override it** | JWT signing key | *(generate your own random string)* |
| `ALGORITHM` | Optional | JWT signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Optional | Access token lifetime | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Optional | Refresh token lifetime | `7` |
| `CORS_ORIGINS` | Has a default | Comma-separated allowed origins | `http://localhost:3000,http://localhost:5173` |
| `CORS_ORIGIN_REGEX` | Has a default | Regex additionally allowing private-LAN IPs | *(see `core/config.py`)* |
| `MINIO_ENDPOINT` | Has a default (a specific LAN IP — set your own) | MinIO host:port | `localhost:9000` |
| `MINIO_ACCESS_KEY` | Required for uploads to work | MinIO access key | `minioadmin` |
| `MINIO_SECRET_KEY` | Required for uploads to work | MinIO secret key | *(never commit)* |
| `MINIO_BUCKET` | Optional | Bucket name for uploads | `ccs-hub` |
| `MINIO_SECURE` | Optional | Use HTTPS to reach MinIO | `False` |
| `MINIO_PUBLIC_URL` | Optional | Public URL prefix if MinIO sits behind a CDN/proxy | *(unset for local dev)* |
| `DEBUG` | Optional | App debug flag (not tied to FastAPI's own debug mode) | `True` |
| `LOG_LEVEL` | Optional | Logging verbosity | `INFO` |
| `APP_ENV` | Optional | Environment label | `development` |
| `APP_NAME` | Optional | Shown in API docs / app metadata | `CCS HUB API` |
| `APP_VERSION` | Optional | Shown in API docs | `1.0.0` |

Frontend (`frontend/.env`, read via Vite's `import.meta.env`):

| Variable | Required | Purpose | Example |
|---|---|---|---|
| `VITE_API_URL` | Optional (has a same-host fallback) | Base URL for REST API calls | `http://localhost:8000/api/v1` |
| `VITE_WS_URL` | Optional (has a same-host fallback) | Base URL for the Socket.IO connection | `ws://localhost:8000` |
| `VITE_APP_NAME` | Optional | App name constant available to the frontend | `CCS HUB` |

---

## Database Setup

Quick reference (see [Step 5](#step-5--postgresql) and
[Step 6](#step-6--database-setup) for full explanations):

```bash
# 1. Create the database/role (one-time, via psql)
psql -U postgres -c "CREATE USER ccs_user WITH PASSWORD 'choose-a-password';"
psql -U postgres -c "CREATE DATABASE ccs_hub OWNER ccs_user;"

# 2. Point the backend at it
#    backend/.env -> DATABASE_URL=postgresql://ccs_user:choose-a-password@localhost:5432/ccs_hub

# 3. Start the backend once - it creates all tables and seeds
#    permissions/roles/the superadmin account automatically
cd backend && uvicorn app.main:app --reload

# 4. Only if upgrading an existing database created before these files
#    existed, also apply (in order):
psql -U ccs_user -d ccs_hub -f backend/migrations/20260812_stream_viewers_active_unique.sql
psql -U ccs_user -d ccs_hub -f backend/migrations/20260817_teaching_assignments_backfill.sql
psql -U ccs_user -d ccs_hub -f backend/migrations/20260820_livestreams_thumbnail_url.sql
psql -U ccs_user -d ccs_hub -f backend/migrations/20260824_teaching_assignments_subject_code_room.sql
psql -U ccs_user -d ccs_hub -f backend/migrations/20260825_conversations_avatar_url.sql
```

There is no `alembic upgrade head` step in this project — Alembic is listed
as a dependency but is not actually configured (no `alembic.ini`/`alembic/`
folder exists in the repository).

---

## Development Commands

### Frontend (from `frontend/`, `package.json` scripts)
| Command | Purpose |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start the Vite dev server (`vite --host`) at `http://localhost:3000` |
| `npm run build` | Type-check (`tsc`) then production build (`vite build`) into `frontend/dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm run format` | Prettier, writes formatting changes |
| `npm run test` | Currently a stub — prints "No tests specified" |

### Backend (from `backend/`, with the venv active)
| Command | Purpose |
|---|---|
| `pip install -r requirements.txt` then `pip install fastapi-mail jinja2 asyncpg` | Install dependencies (see note above) |
| `uvicorn app.main:app --reload` | Start the dev server with auto-reload at `http://localhost:8000` |
| `pytest` | Run the test suite (`backend/app/tests/`, configured via `pyproject.toml`'s `[tool.pytest.ini_options]`) — only `conftest.py` exists today, no test modules were found |
| `black .` | Code formatting (listed as a dev dependency in `pyproject.toml`) |
| `mypy .` | Type checking (listed as a dev dependency in `pyproject.toml`) |

There is no database-migration command to run — see
[Database Setup](#database-setup).

---

## Default Accounts

No hardcoded default accounts exist in this repository. On first backend
startup, `app/seed/admin.py` creates **one** admin account using whatever you
set as `FIRST_SUPERUSER_EMAIL` / `FIRST_SUPERUSER_PASSWORD` in `backend/.env`
— it will not create it again if an account with that email already exists.

To get a Student or Professor account, register through the app's own
registration flow (Professor registration additionally requires an
invitation code, which an admin can generate from the Admin dashboard).

---

## Troubleshooting

**PostgreSQL connection failed**
- *Cause:* `DATABASE_URL` doesn't match a running Postgres server/role/database.
- *Solution:* Confirm Postgres is running (`pg_isready`), confirm the
  user/password/database actually exist, and confirm `DATABASE_URL` starts
  with `postgresql://` (the app rewrites it to `postgresql+asyncpg://`
  itself — don't put `asyncpg` in `.env`).

**Backend fails to start with a Pydantic "field required" error**
- *Cause:* `FIRST_SUPERUSER_EMAIL` and/or `FIRST_SUPERUSER_PASSWORD` are
  missing from `backend/.env` — these have no default value.
- *Solution:* Add both to `.env`.

**`ModuleNotFoundError: No module named 'fastapi_mail'` (or `asyncpg`)**
- *Cause:* `requirements.txt` doesn't list these, but the code imports them.
- *Solution:* `pip install fastapi-mail jinja2 asyncpg` (see [Step 3](#step-3--set-up-the-backend)).

**Redis connection failed**
- *Cause:* Redis isn't running, or `REDIS_URL` points at the wrong host/port.
- *Solution:* `redis-cli ping` should return `PONG`. Email
  verification/forgot-password/change-password links will fail to send (or
  fail to confirm) without a working Redis connection.

**CORS error in the browser console**
- *Cause:* You're loading the frontend from an origin not covered by
  `CORS_ORIGINS`/`CORS_ORIGIN_REGEX` (e.g. a non-default port, or a public
  domain instead of localhost/LAN).
- *Solution:* Add the exact origin to `CORS_ORIGINS` in `backend/.env`
  (comma-separated) and restart the backend.

**WebSocket won't connect (chat/livestream/notifications don't update live)**
- *Cause:* Usually either not logged in (the socket client requires a valid
  access token) or `VITE_WS_URL`/the derived fallback host doesn't match
  where the backend is actually reachable.
- *Solution:* Confirm you're logged in, confirm the backend is reachable at
  the URL the browser is using, and check that the Socket.IO path is
  `/ws/socket.io` (fixed in code, not configurable via `.env`).

**Verification/reset/change-password emails never arrive**
- *Cause:* `MAIL_USERNAME`/`MAIL_PASSWORD` unset or wrong, or your provider
  is blocking the login (e.g. Gmail requires an App Password, not your
  normal password).
- *Solution:* Check the backend console logs — `email_service.py` logs a
  `❌ Failed to send ... email` line on failure with the underlying SMTP
  error. Registration/login itself still succeeds even if the email fails to
  send (by design), so check the logs, not just the UI.

**Environment variable missing**
- *Cause:* A required variable isn't set.
- *Solution:* See the full [Environment Variables](#environment-variables)
  reference table above.

**Port already in use**
- *Cause:* Something else is already bound to 3000 (frontend) or 8000
  (backend).
- *Solution:* Stop the other process, or run
  `uvicorn app.main:app --reload --port 8001` /
  `npm run dev -- --port 3001` and update the corresponding `VITE_API_URL`/
  `CORS_ORIGINS` if you change the backend port.

**`npm install` fails**
- *Cause:* Node version too old, or a corrupted `node_modules`.
- *Solution:* Confirm Node 18+ (`node --version`), delete
  `frontend/node_modules` and `frontend/package-lock.json`-derived cache
  issues, then re-run `npm install`.

**`pip install -r requirements.txt` fails**
- *Cause:* Usually a missing build toolchain for a compiled dependency
  (e.g. `psycopg2-binary` ships prebuilt wheels for common platforms, so
  this is uncommon, but `passlib[bcrypt]`'s `bcrypt` dependency can require
  one on unusual platforms/Python versions).
- *Solution:* Make sure you're using a supported Python version (3.11+) and
  the virtual environment is active before installing.

**Database migration/table-creation issues**
- *Cause:* The app tries to create tables on every startup
  (`Base.metadata.create_all`); if a table already exists with an
  incompatible schema (for example, from `database/init.sql` via the Docker
  path — see the [Installation](#installation) callout), new columns will
  silently **not** be added.
- *Solution:* For a fresh install, start from an empty database and let the
  app create everything itself. For an existing database, apply the manual
  migration scripts (see [Database Setup](#database-setup)).

**Frontend cannot connect to backend**
- *Cause:* Backend not running, wrong URL, or a firewall blocking the port.
- *Solution:* Confirm `http://localhost:8000/health` responds. If it does
  but the frontend still can't reach it, check `VITE_API_URL` in
  `frontend/.env` and the browser console/network tab for the actual failing
  request URL.

**Mobile/LAN access problems**
- *Cause:* Backend started without `--host 0.0.0.0`, a firewall blocking the
  port, or the device isn't on the same network.
- *Solution:* Start the backend with `--host 0.0.0.0` (Step 10), confirm
  your OS firewall allows inbound connections on 3000/8000, and use your
  computer's LAN IP (not `localhost`) from the other device.

---

## Production / Deployment Notes

This repository is set up for local development. Before deploying:

- **`SECRET_KEY`** — the default in `core/config.py`
  (`"your-super-secret-key-here"`) is a placeholder. Generate a strong random
  value and set it via environment variable, never hardcode it.
- **`DEBUG`** — set to `False` (currently defaults to `"True"`).
- **`CORS_ORIGINS`** — restrict to your real production domain(s); the
  default includes `localhost` and the `CORS_ORIGIN_REGEX` permissively
  allows any private-LAN IP, which is only appropriate for local development.
- **Database credentials** — use a dedicated production database
  user/password, not the defaults shown in this guide.
- **SMTP credentials** — use a production-grade transactional email provider
  and a dedicated sending domain/account.
- **MinIO** — `MINIO_SECURE` should be `True` behind HTTPS in production, and
  `MINIO_PUBLIC_URL` should point at your real public storage URL/CDN.
- **HTTPS** — terminate TLS in front of both the frontend and backend (the
  `nginx/` folder in this repo is scaffolding for this, but was not verified
  as part of this review).
- **WebSocket** — make sure your reverse proxy forwards `Upgrade`/
  `Connection` headers so the `/ws/socket.io` path still negotiates
  WebSocket connections through it.
- The `docker-compose.yml` issues noted in [Installation](#installation)
  should be fixed before using that file for any real deployment.

---

## Security Notes

- **Never commit `.env`** — it's already covered by `.gitignore`, but always
  double-check `git status` before committing after editing it.
- **Never commit real secrets** — `SECRET_KEY`, database passwords, SMTP
  password, MinIO keys.
- **Use strong, unique values** for `SECRET_KEY` and all passwords in any
  shared or production environment — the values shown throughout this guide
  (and in `.env.example`) are placeholders only.
- **Use HTTPS in production** for both the frontend and the API/WebSocket
  endpoints.
- **Configure CORS narrowly in production** — the private-LAN regex in
  `CORS_ORIGIN_REGEX` is a development convenience and should not be relied
  on in a production configuration.

---

## Complete Fresh-PC Setup Checklist

```
[ ] Install Git
[ ] Install Node.js 18+
[ ] Install Python 3.11+
[ ] Install PostgreSQL 15
[ ] Install Redis 7
[ ] Install/run MinIO
[ ] Clone the repository
[ ] Create backend venv and activate it
[ ] pip install -r requirements.txt
[ ] pip install fastapi-mail jinja2 asyncpg
[ ] Create backend/.env with all required variables filled in
[ ] Create the PostgreSQL database and role
[ ] Create the MinIO bucket
[ ] Confirm Redis responds to `redis-cli ping`
[ ] Start the backend (creates tables + seeds superadmin automatically)
[ ] cd frontend && npm install
[ ] Create frontend/.env (cp .env.example .env)
[ ] Start the frontend (npm run dev)
[ ] Open http://localhost:3000 and log in with FIRST_SUPERUSER_EMAIL/PASSWORD
[ ] Register a second (student/professor) account and confirm the
    verification email arrives and the link works
[ ] Confirm posts/sections load (verifies the database connection)
[ ] Open chat or a livestream and confirm it updates in real time
    (verifies the WebSocket connection)
```
