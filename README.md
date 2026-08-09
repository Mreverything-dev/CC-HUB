# 🎓 CCS HUB - College of Computer Studies

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue.svg)](https://www.typescriptlang.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-green.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-24-blue.svg)](https://www.docker.com/)

## 📚 Table of Contents
- [Overview](#-overview)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Development Guide](#-development-guide)
- [Database Schema](#-database-schema)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

## 🎯 Overview

**CCS HUB** is an enterprise-grade digital ecosystem designed specifically for the **College of Computer Studies**. It provides a comprehensive platform connecting students, professors, and administrators through social features, academic management, and real-time communication.

### Key Features
- 🔐 **Authentication**: JWT-based authentication with role-based access control (Admin, Professor, Student)
- 👥 **User Management**: Complete user profiles with role-specific information
- 📚 **Section Management**: Create and manage sections, add students, promote officers and mayors
- 📢 **Announcements**: Targeted announcements with role-based visibility
- 📝 **Social Feed**: Create, edit, delete posts with comments and likes
- 💬 **Real-time Chat**: WebSocket-based messaging (Coming Soon)
- 🔔 **Notifications**: Real-time notification system (Coming Soon)
- 📊 **Analytics**: Dashboard with charts and reports (Coming Soon)
- 🤖 **AI Features**: AI chatbot and content recommendations (Coming Soon)

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI Framework |
| TypeScript | 5.2 | Type Safety |
| Vite | 5.0 | Build Tool |
| React Router | 6.20 | Routing |
| TanStack Query | 5.8 | Data Fetching |
| Zustand | 4.4 | State Management |
| Axios | 1.6 | HTTP Client |
| Tailwind CSS | 3.3 | Styling |
| Socket.IO Client | 4.5 | Real-time Communication |
| React Hook Form | 7.48 | Form Management |
| Zod | 3.22 | Validation |
| Framer Motion | 10.16 | Animations |
| Chart.js | 4.4 | Charts & Visualization |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| FastAPI | 0.104 | API Framework |
| Python | 3.11 | Programming Language |
| SQLAlchemy | 2.0 | ORM |
| Alembic | 1.12 | Database Migrations |
| PostgreSQL | 15 | Database |
| Pydantic | 2.5 | Data Validation |
| JWT | python-jose | Authentication |
| Socket.IO | 5.10 | WebSocket |
| Celery | 5.3 | Task Queue |
| Redis | 7 | Cache/Broker |
| MinIO | Latest | Object Storage |

### DevOps
- **Docker** & Docker Compose
- **Nginx** - Web Server & Reverse Proxy
- **GitHub Actions** - CI/CD
- **Prometheus** & **Grafana** - Monitoring

## 📋 Prerequisites

- **Node.js** v18 or higher
- **Python** v3.11 or higher
- **Docker** & Docker Compose
- **Git**
- **Poetry** (Python dependency management)
- **VS Code** (Recommended IDE)

## 🚀 Quick Start

### Option 1: Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/ccs-hub.git
cd ccs-hub

# Copy environment variables
cp .env.example .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
# Or manually
cd frontend && npm install && npm run dev
cd backend && poetry install && poetry run uvicorn app.main:app --reload
\\\

## Access
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/v1
- API Docs: http://localhost:8000/api/docs

## Default Credentials
- Admin: admin@ccshub.edu.ph / Admin@123
- Professor: professor@ccshub.edu.ph / Professor@123
- Student: student@ccshub.edu.ph / Student@123

Manual SETUP
- Backend Setup
cd backend

# Install Poetry
pip install poetry

# Install dependencies
poetry install

# Copy environment variables
cp .env.example .env

# Run migrations
poetry run alembic upgrade head

# Seed database
poetry run python -m app.seed

# Start backend server
poetry run uvicorn app.main:app --reload

Frontend Setup
cd frontend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
