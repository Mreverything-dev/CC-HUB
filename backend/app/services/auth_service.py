# backend/app/services/auth_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models.user import User, Role
from app.models.invitation_code import InvitationCode
from app.models.profile import StudentProfile, ProfessorProfile, AdminProfile
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, RegisterResponse, UserResponse
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token
from app.services.email_service import email_service
from app.services.redis_service import redis_service
from fastapi import HTTPException, status
from datetime import datetime, timedelta, timezone
import logging
import secrets
import string

logger = logging.getLogger(__name__)


def _utc_now() -> datetime:
    """Timezone-aware "now", used everywhere an invitation code's
    expires_at (read back via UTCDateTime, always tz-aware) is compared -
    a naive datetime.utcnow() on one side of that comparison is exactly
    what raises "can't compare offset-naive and offset-aware datetimes"."""
    return datetime.now(timezone.utc)


def _ensure_utc(value: datetime) -> datetime:
    """Normalize a datetime to timezone-aware UTC without blindly
    stripping an existing offset: a naive value is assumed to already mean
    UTC (matching every write path in this file), an aware value is
    converted to UTC rather than re-labeled."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _verification_key(self, token: str) -> str:
        return f"verification:{token}"

    def _password_reset_key(self, token: str) -> str:
        return f"password_reset:{token}"

    def _password_change_key(self, token: str) -> str:
        return f"password_change:{token}"

    async def register(self, request: RegisterRequest) -> RegisterResponse:
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
                noun = "professor registration code" if request.role == "professor" else "registration code"

                if not request.invitation_code:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Invitation code required for {request.role} registration"
                    )

                # Pre-check purely for a specific, helpful error message. It
                # never itself grants access - the atomic DELETE below is the
                # real, race-safe gate (two simultaneous registrations with
                # the same code must never both succeed).
                precheck_result = await self.db.execute(
                    select(InvitationCode).where(InvitationCode.code == request.invitation_code)
                )
                precheck = precheck_result.scalar_one_or_none()

                if not precheck or precheck.role != request.role:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid {noun}.")
                if precheck.is_used:
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"This {noun} has already been used.")
                if _ensure_utc(precheck.expires_at) <= _utc_now():
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"This {noun} has expired.")

                # Atomically consume the code: only one concurrent request can
                # delete this row. The full validity conditions are repeated
                # here (not just the code) so a request that raced past the
                # pre-check above still can't consume an already-used/expired
                # row. If we deleted 0 rows despite the pre-check looking
                # valid, someone else won the race in the meantime.
                consume_result = await self.db.execute(
                    delete(InvitationCode).where(
                        InvitationCode.code == request.invitation_code,
                        InvitationCode.role == request.role,
                        InvitationCode.is_used == False,
                        InvitationCode.expires_at > _utc_now(),
                    )
                )
                if consume_result.rowcount == 0:
                    await self.db.rollback()
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"This {noun} has already been used.")

                await self.db.commit()
                logger.info(f"✅ Invitation code consumed for {request.role} registration")
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

            # --- CREATE USER with verification fields ---
            # ✅ Generate verification token
            verification_token = secrets.token_urlsafe(32)
            verification_expires = datetime.utcnow() + timedelta(
                minutes=60  # Token expires in 60 minutes
            )
            
            user = User(
                email=request.email,
                username=request.username,
                password_hash=hashed_password,
                role=request.role,
                is_active=True,
                is_verified=False,  # ✅ User starts as unverified
                verification_token=verification_token,  # ✅ Store token
                verification_token_expires=verification_expires  # ✅ Store expiration
            )
            
            self.db.add(user)
            await self.db.commit()
            await self.db.refresh(user)
            logger.info(f"✅ User created with ID: {user.id} and role: {user.role}")

            # --- CREATE PROFILE ROW ---
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

            # --- ✅ Send verification email (Non-blocking) ---
            try:
                await email_service.send_verification_email(
                    to_email=user.email,
                    username=user.username,
                    token=verification_token
                )
                logger.info(f"✅ Verification email sent to {user.email}")
            except Exception as e:
                logger.error(f"❌ Failed to send verification email: {e}")
                # Don't fail registration if email fails

            # --- ✅ Store token in Redis for faster lookups ---
            try:
                await redis_service.set_token(
                    self._verification_key(verification_token),
                    {"user_id": str(user.id), "email": user.email},
                    60 * 60  # 60 minutes
                )
                logger.info(f"✅ Verification token stored in Redis")
            except Exception as e:
                logger.error(f"❌ Failed to store token in Redis: {e}")

            # --- ✅ No tokens issued here on purpose: the account is
            # unverified until the user clicks the emailed link, so
            # registration must not hand out a working session (that would
            # let an unverified account skip straight to the dashboard, or
            # call protected APIs directly with the response token). The
            # user logs in normally - and is verified - afterward.
            user_response = UserResponse.model_validate(user)

            return RegisterResponse(
                message="Registration successful. Please check your email to verify your account.",
                user=user_response,
                requires_verification=True,
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

    # ============================================
    # ✅ EMAIL VERIFICATION
    # ============================================
    async def verify_email(self, token: str) -> dict:
        """Verify user email with token"""
        logger.info(f"🔐 Verifying email with token: {token[:20]}...")
        
        try:
            # ✅ Check Redis first for fast lookup
            redis_data = await redis_service.get_token(self._verification_key(token))
            
            if redis_data:
                user_id = redis_data.get("user_id")
                # Find user by ID
                result = await self.db.execute(
                    select(User).where(
                        User.id == user_id,
                        User.is_verified == False
                    )
                )
                user = result.scalar_one_or_none()
            else:
                # Fallback to database lookup
                result = await self.db.execute(
                    select(User).where(
                        User.verification_token == token,
                        User.verification_token_expires > datetime.utcnow(),
                        User.is_verified == False
                    )
                )
                user = result.scalar_one_or_none()
            
            if not user:
                # Check if already verified
                result = await self.db.execute(
                    select(User).where(
                        User.verification_token == token,
                        User.is_verified == True
                    )
                )
                already_verified = result.scalar_one_or_none()
                if already_verified:
                    return {
                        "message": "Email already verified",
                        "verified": True
                    }
                
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or expired verification token"
                )
            
            # ✅ Verify user. Deliberately keep verification_token on the row
            # (instead of nulling it) so a repeat click on the same link can
            # still be recognized as "already verified" below - the primary
            # lookup above already requires is_verified == False, so a stale
            # token can never be replayed to re-verify or affect another user.
            user.is_verified = True
            user.verification_token_expires = None
            await self.db.commit()
            
            # ✅ Delete token from Redis
            await redis_service.delete_token(self._verification_key(token))
            
            logger.info(f"✅ Email verified for user: {user.email}")
            
            # ✅ Send welcome email
            try:
                await email_service.send_welcome_email(
                    to_email=user.email,
                    username=user.username
                )
                logger.info(f"✅ Welcome email sent to {user.email}")
            except Exception as e:
                logger.error(f"❌ Failed to send welcome email: {e}")
            
            return {
                "message": "Email verified successfully",
                "verified": True
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Email verification error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Email verification failed: {str(e)}"
            )

    # ============================================
    # ✅ RESEND VERIFICATION EMAIL
    # ============================================
    async def resend_verification(self, email: str) -> dict:
        """Resend verification email"""
        logger.info(f"📧 Resending verification email to: {email}")
        
        try:
            result = await self.db.execute(
                select(User).where(
                    User.email == email,
                    User.is_verified == False
                )
            )
            user = result.scalar_one_or_none()
            
            if not user:
                # Check if already verified
                result = await self.db.execute(
                    select(User).where(
                        User.email == email,
                        User.is_verified == True
                    )
                )
                if result.scalar_one_or_none():
                    return {
                        "message": "Email already verified",
                        "verified": True
                    }
                
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found"
                )
            
            # ✅ Generate new token
            verification_token = secrets.token_urlsafe(32)
            verification_expires = datetime.utcnow() + timedelta(minutes=60)
            
            user.verification_token = verification_token
            user.verification_token_expires = verification_expires
            await self.db.commit()
            
            # ✅ Store in Redis
            await redis_service.set_token(
                self._verification_key(verification_token),
                {"user_id": str(user.id), "email": user.email},
                60 * 60
            )
            
            # ✅ Send email
            try:
                await email_service.send_verification_email(
                    to_email=user.email,
                    username=user.username,
                    token=verification_token
                )
                logger.info(f"✅ Verification email resent to {user.email}")
            except Exception as e:
                logger.error(f"❌ Failed to send verification email: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to send verification email"
                )
            
            return {"message": "Verification email sent successfully"}
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Resend verification error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to resend verification: {str(e)}"
            )

    # ============================================
    # ✅ CHECK VERIFICATION STATUS
    # ============================================
    async def check_verification_status(self, user_id: str) -> dict:
        """Check if user is verified"""
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
            
            return {
                "is_verified": user.is_verified,
                "email": user.email,
                "username": user.username
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Check verification status error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to check verification status: {str(e)}"
            )

    async def forgot_password(self, email: str) -> dict:
        logger.info(f"📧 Password reset requested for: {email}")

        result = await self.db.execute(
            select(User).where(User.email == email, User.is_active == True)
        )
        user = result.scalar_one_or_none()

        if not user:
            return {"message": "If the email exists, a reset link has been sent", "success": True}

        reset_token = secrets.token_urlsafe(32)
        reset_expires = datetime.utcnow() + timedelta(minutes=30)

        await redis_service.set_token(
            self._password_reset_key(reset_token),
            {"user_id": str(user.id), "email": user.email},
            30 * 60
        )

        # Same defensive wrapping as register()'s verification email - never let
        # an email/SMTP problem turn into a 500 or a response that reveals
        # whether the address exists.
        try:
            await email_service.send_password_reset_email(
                to_email=user.email,
                username=user.username,
                token=reset_token
            )
        except Exception as e:
            logger.error(f"❌ Failed to send password reset email: {e}")

        return {"message": "If the email exists, a reset link has been sent", "success": True}

    async def reset_password(self, token: str, new_password: str) -> dict:
        logger.info("🔐 Resetting password with token")

        redis_data = await redis_service.get_token(self._password_reset_key(token))
        user = None

        if redis_data:
            result = await self.db.execute(
                select(User).where(User.id == redis_data.get("user_id"), User.is_active == True)
            )
            user = result.scalar_one_or_none()
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token"
            )

        user.password_hash = get_password_hash(new_password)
        await self.db.commit()
        await redis_service.delete_token(self._password_reset_key(token))
        return {"message": "Password reset successfully", "success": True}

    # ============================================
    # CREATE INVITATION CODE (Admin only)
    # ============================================
    async def create_invitation_code(
        self, admin_id: str, role: str, expires_in_hours: int = 168, code_prefix: str = ""
    ) -> dict:
        """Create a single-use invitation code for professor or admin
        registration (Admin only). Uses `secrets` (cryptographically secure),
        never a predictable generator. expires_in_hours defaults to 168 (7
        days) to match the previous default duration."""
        if role not in ["professor", "admin"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role must be 'professor' or 'admin'"
            )

        def _generate() -> str:
            return code_prefix + ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))

        # Generate a unique code (collisions are astronomically unlikely at
        # 8 random alphanumeric characters, but check anyway).
        code = _generate()
        result = await self.db.execute(
            select(InvitationCode).where(InvitationCode.code == code)
        )
        while result.scalar_one_or_none():
            code = _generate()
            result = await self.db.execute(
                select(InvitationCode).where(InvitationCode.code == code)
            )

        invitation = InvitationCode(
            code=code,
            role=role,
            created_by=admin_id,
            expires_at=_utc_now() + timedelta(hours=expires_in_hours)
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
    async def get_invitation_codes(self, admin_id: str, role: str = None) -> list:
        """Get active (unused, unexpired) invitation codes, optionally
        scoped to one role (Admin only). Opportunistically deletes any
        already-expired rows on every call - a simple, self-contained
        cleanup that needs no separate background job/Redis infrastructure,
        since this list is the only place expired codes would otherwise
        linger and be visible."""
        await self.db.execute(
            delete(InvitationCode).where(InvitationCode.expires_at <= _utc_now())
        )
        await self.db.commit()

        query = select(InvitationCode).where(InvitationCode.is_used == False).order_by(InvitationCode.created_at.desc())
        if role:
            query = query.where(InvitationCode.role == role)
        result = await self.db.execute(query)
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

            # ✅ Unverified accounts cannot log in - this is the only place
            # that would otherwise hand an unverified user a working session.
            if not user.is_verified:
                logger.warning(f"❌ Unverified account: {request.email}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Please verify your email before logging in"
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
    # CHANGE PASSWORD (two-step: request -> email confirmation -> apply)
    # ============================================
    async def request_change_password(self, user_id: str, request) -> dict:
        """Step 1: validate the current password and new-password
        requirements (both already enforced by ChangePasswordRequest's own
        validators - min length, confirm-match), then email a confirmation
        link before touching the database. Mirrors forgot_password's
        token-in-Redis pattern exactly, except the value stored is the
        ALREADY-HASHED new password (computed now, while the request is
        still authenticated and trusted) rather than just a user id - so
        confirm_change_password never needs the plaintext again and the
        applied hash can't drift from what was actually confirmed."""
        logger.info(f"🔑 Password change requested for user: {user_id}")

        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if not verify_password(request.current_password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")

        if verify_password(request.new_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be different from your current password",
            )

        new_password_hash = get_password_hash(request.new_password)
        change_token = secrets.token_urlsafe(32)

        await redis_service.set_token(
            self._password_change_key(change_token),
            {"user_id": str(user.id), "new_password_hash": new_password_hash},
            30 * 60,  # 30 minutes, same window as forgot/reset-password
        )

        try:
            await email_service.send_password_change_confirmation_email(
                to_email=user.email,
                username=user.username,
                token=change_token,
            )
        except Exception as e:
            logger.error(f"❌ Failed to send password change confirmation email: {e}")
            await redis_service.delete_token(self._password_change_key(change_token))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send confirmation email. Please try again.",
            )

        logger.info(f"📧 Password change confirmation email sent for user: {user.email}")
        return {
            "message": "We've sent a confirmation link to your email. Click it to finish changing your password.",
            "requires_verification": True,
        }

    async def confirm_change_password(self, token: str) -> dict:
        """Step 2: the user clicked the emailed confirmation link - apply
        the new password hash that was already computed and validated in
        request_change_password.

        The actual password_hash write happens at most once per token (see
        the `consumed` check below) - but a REPEAT confirmation of the same
        token must still succeed, not error. Without that, this token
        behaves like a true one-time-use secret that vanishes the instant
        it's redeemed, which breaks the very next duplicate request for
        entirely ordinary reasons: React 18 StrictMode fires effects twice
        in dev, an email client's link-scanner (Outlook Safe Links, Gmail
        image/link proxying, etc.) can visit the URL before the user ever
        clicks it, and a page refresh or double-click both re-fire the same
        request. verify_email() already solves this correctly by keeping
        the token row and checking is_verified on a repeat lookup instead of
        deleting it outright - this mirrors that exact pattern instead of
        treating "already confirmed" as indistinguishable from "never
        existed"."""
        logger.info("🔐 Confirming password change with token")

        redis_data = await redis_service.get_token(self._password_change_key(token))
        if not redis_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired confirmation link. Please request the password change again.",
            )

        result = await self.db.execute(
            select(User).where(User.id == redis_data.get("user_id"), User.is_active == True)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired confirmation link")

        if not redis_data.get("consumed"):
            user.password_hash = redis_data.get("new_password_hash")
            await self.db.commit()

            # Mark consumed rather than delete outright, so a near-simultaneous
            # repeat confirmation of this exact token is idempotent (same
            # success response) instead of a false "invalid or expired" - the
            # password_hash write above still only ever happens this one time,
            # guarded by this same `consumed` check.
            await redis_service.set_token(
                self._password_change_key(token),
                {"user_id": redis_data.get("user_id"), "consumed": True},
                30 * 60,
            )
            logger.info(f"✅ Password change confirmed for user: {user.email}")
        else:
            logger.info(f"ℹ️ Password change link re-opened after already being confirmed for user: {user.email}")

        return {"message": "Your password has been changed successfully.", "success": True}
