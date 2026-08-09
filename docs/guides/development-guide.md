# Development Guide

## Prerequisites
- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- Poetry

## Setup

### Frontend
\\\ash
cd frontend
npm install
npm run dev
\\\

### Backend
\\\ash
cd backend
poetry install
poetry run uvicorn app.main:app --reload
\\\

### Database
\\\ash
docker-compose up -d postgres
cd backend
poetry run alembic upgrade head
\\\
