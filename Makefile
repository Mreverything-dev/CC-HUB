.PHONY: help dev test build clean install frontend backend

help:
	@echo "Available commands:"
	@echo "  make dev          - Start development environment"
	@echo "  make test         - Run all tests"
	@echo "  make build        - Build Docker images"
	@echo "  make frontend     - Start frontend only"
	@echo "  make backend      - Start backend only"
	@echo "  make install      - Install all dependencies"
	@echo "  make db-migrate   - Run database migrations"
	@echo "  make db-seed      - Seed database"
	@echo "  make clean        - Clean up"

dev:
	docker-compose up -d
	docker-compose logs -f

frontend:
	cd frontend && npm run dev

backend:
	cd backend && poetry run uvicorn app.main:app --reload

install:
	cd frontend && npm install
	cd backend && poetry install

test:
	cd backend && poetry run pytest
	cd frontend && npm run test

build:
	docker-compose build

db-migrate:
	cd backend && poetry run alembic upgrade head

db-seed:
	cd backend && poetry run python -m app.seed

clean:
	docker-compose down -v
	rm -rf frontend/dist
	rm -rf frontend/node_modules
	rm -rf backend/__pycache__
	rm -rf backend/.pytest_cache
