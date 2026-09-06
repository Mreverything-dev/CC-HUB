# backend/app/services/google_auth_service.py
from authlib.integrations.httpx_client import AsyncOAuth2Client
from app.core.config import settings
import logging
import httpx

logger = logging.getLogger(__name__)

class GoogleAuthService:
    def __init__(self):
        self.client_id = settings.GOOGLE_CLIENT_ID
        self.client_secret = settings.GOOGLE_CLIENT_SECRET
        self.redirect_uri = settings.GOOGLE_REDIRECT_URI
        self.authorize_url = "https://accounts.google.com/o/oauth2/v2/auth"
        self.token_url = "https://oauth2.googleapis.com/token"
        self.userinfo_url = "https://www.googleapis.com/oauth2/v3/userinfo"
        self.scope = "openid email profile"

    def get_authorization_url(self) -> str:
        """Generate Google OAuth authorization URL"""
        client = AsyncOAuth2Client(
            self.client_id,
            client_secret=self.client_secret,
            redirect_uri=self.redirect_uri,
            scope=self.scope,
        )
        uri, state = client.create_authorization_url(self.authorize_url)
        return uri

    async def get_user_info(self, code: str) -> dict:
        """Exchange code for user info"""
        try:
            client = AsyncOAuth2Client(
                self.client_id,
                client_secret=self.client_secret,
                redirect_uri=self.redirect_uri,
                scope=self.scope,
            )
            
            # Exchange code for token. The frontend obtains this code via
            # @react-oauth/google's useGoogleLogin({flow: 'auth-code'})
            # popup, which requests it from Google using the special
            # redirect_uri "postmessage" (not a real URL) - the token
            # exchange must use that same value or Google rejects it with
            # redirect_uri_mismatch/invalid_grant. This is independent of
            # GOOGLE_REDIRECT_URI, which only applies to a full-page
            # redirect flow (unused by the current frontend).
            token = await client.fetch_token(
                self.token_url,
                code=code,
                grant_type="authorization_code",
                redirect_uri="postmessage",
            )
            
            # Get user info
            async with httpx.AsyncClient() as http_client:
                response = await http_client.get(
                    self.userinfo_url,
                    headers={"Authorization": f"Bearer {token['access_token']}"}
                )
                user_info = response.json()
                
                logger.info(f"✅ Google user info retrieved: {user_info.get('email')}")
                return user_info
                
        except Exception as e:
            logger.error(f"❌ Google OAuth error: {e}")
            raise

# Create singleton instance
google_auth_service = GoogleAuthService()