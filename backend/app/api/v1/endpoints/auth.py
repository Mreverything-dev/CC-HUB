# backend/app/api/v1/endpoints/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.auth_service import AuthService
from app.schemas.auth import (
    LoginRequest, RegisterRequest, TokenResponse, 
    RefreshTokenRequest, ChangePasswordRequest, UserResponse
)
from app.dependencies.auth import get_current_user
from app.models.user import User
from typing import Any

router = APIRouter()

@router.post("/register", response_model=TokenResponse)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Register a new user with profile creation
    """
    service = AuthService(db)
    return await service.register(request)

@router.post("/login", response_model=TokenResponse)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Login user and return JWT tokens"""
    service = AuthService(db)
    return await service.login(request)

@router.post("/refresh")
async def refresh_token(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Refresh access token"""
    service = AuthService(db)
    return await service.refresh_token(request.refresh_token)

@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Logout user"""
    service = AuthService(db)
    return await service.logout(str(current_user.id))

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
) -> Any:
    """Get current user information"""
    return UserResponse.model_validate(current_user)

@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Change user password"""
    service = AuthService(db)
    return await service.change_password(str(current_user.id), request)