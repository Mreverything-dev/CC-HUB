# backend/app/main.py
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router
from app.core.database import engine, Base
import socketio
import os
from app.websocket.manager import sio

# Create tables
async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    yield

# Initialize app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="CCS HUB - College of Computer Studies API",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(api_router, prefix="/api/v1")

# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "CCS HUB API",
        "version": settings.APP_VERSION,
        "status": "operational"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# ✅ Wrap the FastAPI app with the Socket.IO ASGI app.
# python-socketio's ASGIApp must be the top-level ASGI callable so it can
# negotiate the WebSocket handshake directly - mounting it as a Starlette
# sub-app (app.mount(...)) breaks the handshake ("Expected ASGI message
# 'websocket.accept' ... but got 'http.response.start'"). Non-socketio
# requests (scope path not under /socket.io) are forwarded untouched to
# the FastAPI app via other_asgi_app, including lifespan startup/shutdown.
app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="ws/socket.io")

# Run with: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )