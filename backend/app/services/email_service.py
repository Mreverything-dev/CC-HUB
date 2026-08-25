# backend/app/services/email_service.py
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from fastapi_mail.errors import ConnectionErrors
from jinja2 import Environment, FileSystemLoader
from app.core.config import settings
from datetime import datetime
import logging
from pathlib import Path
import os

logger = logging.getLogger(__name__)

# Setup Jinja2 template environment
TEMPLATE_DIR = Path(__file__).parent.parent / "templates" / "email"
TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)
env = Environment(loader=FileSystemLoader(str(TEMPLATE_DIR)))

# Email configuration
conf = ConnectionConfig(  
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_STARTTLS=settings.MAIL_STARTTLS,
    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    USE_CREDENTIALS=settings.USE_CREDENTIALS,
    VALIDATE_CERTS=settings.VALIDATE_CERTS,
    TIMEOUT=10,  # fail fast instead of hanging the request if SMTP is unreachable
)

class EmailService:
    def __init__(self):
        self.fastmail = FastMail(conf)
        self.template_env = env

    async def send_verification_email(self, to_email: str, username: str, token: str):
        """Send email verification link using fastapi-mail"""
        verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
        
        # Render HTML template
        template = self.template_env.get_template("verification_email.html")
        html_content = template.render(
            username=username,
            verification_url=verification_url,
            app_name=settings.APP_NAME,
            year=datetime.utcnow().year
        )

        # Create message
        message = MessageSchema(
            subject=f"Verify Your Email Address - {settings.APP_NAME}",
            recipients=[to_email],
            body=html_content,
            subtype=MessageType.html
        )

        try:
            await self.fastmail.send_message(message)
            logger.info(f"✅ Verification email sent to {to_email}")
            return True
        except ConnectionErrors as e:
            logger.error(f"❌ Failed to send email: {e}")
            return False

    async def send_welcome_email(self, to_email: str, username: str):
        """Send welcome email"""
        template = self.template_env.get_template("welcome_email.html")
        html_content = template.render(
            username=username,
            app_name=settings.APP_NAME,
            year=datetime.utcnow().year,
            login_url=f"{settings.FRONTEND_URL}/login"
        )

        message = MessageSchema(
            subject=f"Welcome to {settings.APP_NAME}!",
            recipients=[to_email],
            body=html_content,
            subtype=MessageType.html
        )

        try:
            await self.fastmail.send_message(message)
            logger.info(f"✅ Welcome email sent to {to_email}")
            return True
        except ConnectionErrors as e:
            logger.error(f"❌ Failed to send welcome email: {e}")
            return False

    async def send_password_reset_email(self, to_email: str, username: str, token: str):
        """Send password reset email"""
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        
        template = self.template_env.get_template("password_reset_email.html")
        html_content = template.render(
            username=username,
            reset_url=reset_url,
            app_name=settings.APP_NAME,
            year=datetime.utcnow().year
        )

        message = MessageSchema(
            subject=f"Reset Your Password - {settings.APP_NAME}",
            recipients=[to_email],
            body=html_content,
            subtype=MessageType.html
        )

        try:
            await self.fastmail.send_message(message)
            logger.info(f"✅ Password reset email sent to {to_email}")
            return True
        except ConnectionErrors as e:
            logger.error(f"❌ Failed to send password reset email: {e}")
            return False

    async def send_password_change_confirmation_email(self, to_email: str, username: str, token: str):
        """Send the confirm-my-password-change link for an authenticated
        Settings > Security change - a distinct template from
        send_password_reset_email since the wording differs (this is a
        change the user just initiated while logged in, not an "I forgot my
        password" request)."""
        confirm_url = f"{settings.FRONTEND_URL}/confirm-password-change?token={token}"

        template = self.template_env.get_template("password_change_confirmation_email.html")
        html_content = template.render(
            username=username,
            confirm_url=confirm_url,
            app_name=settings.APP_NAME,
            year=datetime.utcnow().year
        )

        message = MessageSchema(
            subject=f"Confirm Your Password Change - {settings.APP_NAME}",
            recipients=[to_email],
            body=html_content,
            subtype=MessageType.html
        )

        try:
            await self.fastmail.send_message(message)
            logger.info(f"✅ Password change confirmation email sent to {to_email}")
            return True
        except ConnectionErrors as e:
            logger.error(f"❌ Failed to send password change confirmation email: {e}")
            return False

# Create singleton instance
email_service = EmailService()