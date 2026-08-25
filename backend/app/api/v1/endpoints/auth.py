# backend/app/api/v1/endpoints/auth.py
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.auth_service import AuthService
from app.schemas.auth import (
    LoginRequest, RegisterRequest, TokenResponse, RegisterResponse,
    RefreshTokenRequest, ChangePasswordRequest, ChangePasswordResponse,
    ConfirmChangePasswordResponse, UserResponse,
    ResendVerificationRequest, VerifyEmailResponse,
    ForgotPasswordRequest, ResetPasswordRequest, PasswordResetResponse
)
from app.dependencies.auth import get_current_user
from app.models.user import User
from typing import Any
from app.schemas.auth import UpdateUsernameRequest

router = APIRouter()

# ============================================
# AUTHENTICATION ENDPOINTS
# ============================================

@router.post("/register", response_model=RegisterResponse)
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

@router.post("/change-password", response_model=ChangePasswordResponse)
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Step 1 of changing your password: validates the current password and
    the new password's requirements, then emails a confirmation link. The
    password itself is NOT changed until that link is clicked (see
    /confirm-change-password) - mirrors the existing forgot/reset-password
    flow's token-then-confirm shape."""
    service = AuthService(db)
    return await service.request_change_password(str(current_user.id), request)

@router.get("/confirm-change-password", response_model=ConfirmChangePasswordResponse)
async def confirm_change_password(
    token: str = Query(..., description="Confirmation token from email"),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Step 2: applies the new password after the user clicks the emailed
    confirmation link - same GET-with-token shape as /verify-email."""
    service = AuthService(db)
    return await service.confirm_change_password(token)

@router.put("/update-username")
async def update_username(
    request: UpdateUsernameRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Update current user's username"""
    # Check if username is taken
    result = await db.execute(
        select(User).where(
            User.username == request.username,
            User.id != current_user.id
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    current_user.username = request.username
    await db.commit()
    await db.refresh(current_user)
    
    return {
        "message": "Username updated successfully",
        "username": current_user.username
    }

# ============================================
# ✅ EMAIL VERIFICATION ENDPOINTS
# ============================================

@router.get("/verify-email", response_model=VerifyEmailResponse)
async def verify_email(
    token: str = Query(..., description="Verification token from email"),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Verify user email with token from email link
    
    - **token**: Verification token received in email
    - Returns verification status
    """
    service = AuthService(db)
    return await service.verify_email(token)

@router.post("/resend-verification")
async def resend_verification(
    request: ResendVerificationRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Resend verification email
    
    - **email**: Email address to resend verification to
    - Returns success message
    """
    service = AuthService(db)
    return await service.resend_verification(request.email)

@router.get("/verification-status")
async def check_verification_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Check if current user is verified
    
    - Returns verification status
    """
    service = AuthService(db)
    return await service.check_verification_status(str(current_user.id))

@router.post("/forgot-password", response_model=PasswordResetResponse)
async def forgot_password(
    request: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    service = AuthService(db)
    return await service.forgot_password(request.email)

@router.post("/reset-password", response_model=PasswordResetResponse)
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    service = AuthService(db)
    return await service.reset_password(request.token, request.new_password)
