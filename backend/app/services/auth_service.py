# backend/app/services/auth_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User, Role
from app.models.invitation_code import InvitationCode
from app.models.profile import StudentProfile, ProfessorProfile, AdminProfile
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token
from fastapi import HTTPException, status
from datetime import datetime, timedelta
import logging
import secrets
import string

logger = logging.getLogger(__name__)

class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def register(self, request: RegisterRequest) -> TokenResponse:
        """Register a new user with invitation code validation for professor/admin"""
        logger.info(f"📝 Registering user: {request.email} with role: {request.role}")
        
        try:
            # --- Check if email exists ---
            result = await self.db.execute(
                select(User).where(User.email == request.email)
            )
            if result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
            
            # --- Check if username exists ---
            result = await self.db.execute(
                select(User).where(User.username == request.username)
            )
            if result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken"
                )

            # --- INVITATION CODE VALIDATION (Professor/Admin only) ---
            if request.role in ["professor", "admin"]:
                if not request.invitation_code:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invitation code required for {request.role} registration"
                    )
                
                code_result = await self.db.execute(
                    select(InvitationCode).where(
                        InvitationCode.code == request.invitation_code,
                        InvitationCode.role == request.role,
                        InvitationCode.is_used == False,
                        InvitationCode.expires_at > datetime.utcnow()
                    )
                )
                invitation = code_result.scalar_one_or_none()
                
                if not invitation:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid or expired invitation code"
                    )
                
                logger.info(f"✅ Valid invitation code found for {request.role}")
                
                # Mark invitation code as used
                invitation.is_used = True
                await self.db.commit()
            else:
                logger.info("✅ Student registration - no invitation code required")

            # --- HASH PASSWORD ---
            try:
                hashed_password = get_password_hash(request.password)
                logger.info("✅ Password hashed successfully")
            except Exception as e:
                logger.error(f"❌ Password hashing failed: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Password hashing error: {str(e)}"
                )

            # --- CREATE USER ---
            user = User(
                email=request.email,
                username=request.username,
                password_hash=hashed_password,
                role=request.role,  # Role is stored directly in the column
                is_active=True,
                is_verified=True
            )
            
            self.db.add(user)
            await self.db.commit()
            await self.db.refresh(user)
            logger.info(f"✅ User created with ID: {user.id} and role: {user.role}")

            # --- CREATE PROFILE ROW (so /profiles/{role} updates have something to update) ---
            if request.role == "student":
                self.db.add(StudentProfile(
                    user_id=user.id,
                    first_name=request.first_name,
                    last_name=request.last_name,
                    student_id=request.student_id,
                    course=request.course,
                    year_level=request.year_level,
                    section_id=request.section_id,
                ))
            elif request.role == "professor":
                self.db.add(ProfessorProfile(
                    user_id=user.id,
                    first_name=request.first_name,
                    last_name=request.last_name,
                    employee_id=request.employee_id,
                    department=request.department,
                    title=request.title,
                ))
            elif request.role == "admin":
                self.db.add(AdminProfile(
                    user_id=user.id,
                    first_name=request.first_name,
                    last_name=request.last_name,
                    position=request.position,
                ))
            await self.db.commit()
            logger.info(f"✅ Profile row created for user: {user.id}")

            # --- SKIP the separate role assignment to avoid the greenlet error ---
            # The user's role is already set in the 'role' column of the users table.
            # No need to also add it to the 'user_roles' many-to-many table.

            # --- Update invitation code with the user who used it (for professor/admin) ---
            if request.role in ["professor", "admin"] and invitation:
                invitation.used_by = user.id
                await self.db.commit()

            # --- CREATE TOKENS ---
            access_token = create_access_token(
                data={"sub": str(user.id), "role": user.role}
            )
            refresh_token = create_refresh_token(
                data={"sub": str(user.id)}
            )

            user_response = UserResponse.model_validate(user)
            
            return TokenResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                user=user_response
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Registration error: {e}")
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Registration failed: {str(e)}"
            )

    # --- The rest of your methods (login, refresh_token, logout, change_password, 
    # create_invitation_code, get_invitation_codes, delete_invitation_code) 
    # remain exactly as they were ---

    # ============================================
    # CREATE INVITATION CODE (Admin only)
    # ============================================
    async def create_invitation_code(self, admin_id: str, role: str, expires_in_days: int = 7) -> dict:
        """Create an invitation code for professor or admin (Admin only)"""
        if role not in ["professor", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role must be 'professor' or 'admin'"
            )
        
        # Generate unique code
        code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
        
        # Check if code already exists
        result = await self.db.execute(
            select(InvitationCode).where(InvitationCode.code == code)
        )
        while result.scalar_one_or_none():
            code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))
            result = await self.db.execute(
                select(InvitationCode).where(InvitationCode.code == code)
            )
        
        # Create invitation
        invitation = InvitationCode(
            code=code,
            role=role,
            created_by=admin_id,
            expires_at=datetime.utcnow() + timedelta(days=expires_in_days)
        )
        self.db.add(invitation)
        await self.db.commit()
        await self.db.refresh(invitation)
        
        logger.info(f"✅ Invitation code created: {code} for role: {role}")
        
        return {
            "code": invitation.code,
            "role": invitation.role,
            "expires_at": invitation.expires_at,
            "created_at": invitation.created_at
        }

    # ============================================
    # GET ALL INVITATION CODES (Admin only)
    # ============================================
    async def get_invitation_codes(self, admin_id: str) -> list:
        """Get all invitation codes (Admin only)"""
        result = await self.db.execute(
            select(InvitationCode).order_by(InvitationCode.created_at.desc())
        )
        return result.scalars().all()

    # ============================================
    # DELETE INVITATION CODE (Admin only)
    # ============================================
    async def delete_invitation_code(self, admin_id: str, code: str) -> dict:
        """Delete an invitation code (Admin only)"""
        result = await self.db.execute(
            select(InvitationCode).where(InvitationCode.code == code)
        )
        invitation = result.scalar_one_or_none()
        
        if not invitation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Invitation code not found"
            )
        
        if invitation.is_used:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete a used invitation code"
            )
        
        await self.db.delete(invitation)
        await self.db.commit()
        
        logger.info(f"✅ Invitation code deleted: {code}")
        return {"message": "Invitation code deleted successfully"}

    # ============================================
    # LOGIN
    # ============================================
    async def login(self, request: LoginRequest) -> TokenResponse:
        """Login user"""
        logger.info(f"🔐 Login attempt: {request.email}")
        
        try:
            result = await self.db.execute(
                select(User).where(User.email == request.email)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                logger.warning(f"❌ User not found: {request.email}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials"
                )
            
            try:
                password_valid = verify_password(request.password, user.password_hash)
            except Exception as e:
                logger.error(f"❌ Password verification error: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Password verification failed"
                )
            
            if not password_valid:
                logger.warning(f"❌ Invalid password for: {request.email}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials"
                )
            
            if not user.is_active:
                logger.warning(f"❌ Inactive account: {request.email}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Account is disabled"
                )

            user.last_login = datetime.utcnow()
            await self.db.commit()
            logger.info(f"✅ Login successful: {request.email}")

            access_token = create_access_token(
                data={"sub": str(user.id), "role": user.role}
            )
            refresh_token = create_refresh_token(
                data={"sub": str(user.id)}
            )

            user_response = UserResponse.model_validate(user)

            return TokenResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                user=user_response
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Login error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Login failed: {str(e)}"
            )

    # ============================================
    # REFRESH TOKEN
    # ============================================
    async def refresh_token(self, refresh_token: str) -> dict:
        """Refresh access token using refresh token"""
        logger.info("🔄 Refreshing token")
        
        try:
            payload = decode_token(refresh_token)
            
            if not payload:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid refresh token"
                )
            
            if payload.get("type") != "refresh":
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token type"
                )
            
            user_id = payload.get("sub")
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token payload"
                )
            
            result = await self.db.execute(
                select(User).where(User.id == user_id, User.is_active == True)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found or inactive"
                )

            access_token = create_access_token(
                data={"sub": str(user.id), "role": user.role}
            )
            
            logger.info(f"✅ Token refreshed for user: {user.email}")
            return {"access_token": access_token, "token_type": "bearer"}
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Token refresh error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Token refresh failed: {str(e)}"
            )

    # ============================================
    # LOGOUT
    # ============================================
    async def logout(self, user_id: str) -> dict:
        """Logout user (client side token removal)"""
        logger.info(f"🚪 Logout user: {user_id}")
        return {"message": "Successfully logged out"}

    # ============================================
    # CHANGE PASSWORD
    # ============================================
    async def change_password(self, user_id: str, request) -> dict:
        """Change user password"""
        logger.info(f"🔑 Changing password for user: {user_id}")
        
        try:
            result = await self.db.execute(
                select(User).where(User.id == user_id)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
            
            if not verify_password(request.current_password, user.password_hash):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Current password is incorrect"
                )
            
            user.password_hash = get_password_hash(request.new_password)
            await self.db.commit()
            
            logger.info(f"✅ Password changed for user: {user.email}")
            return {"message": "Password changed successfully"}
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Password change error: {e}")
            await self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Password change failed: {str(e)}"
            )
