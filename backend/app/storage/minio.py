# backend/app/storage/minio.py
from minio import Minio
from minio.error import S3Error
from fastapi import UploadFile, HTTPException, status
from app.core.config import settings
import uuid
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

# File type definitions
VIDEO_TYPES = {
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
}

MAX_IMAGE_SIZE = 10 * 1024 * 1024    # 10MB for images & docs
MAX_VIDEO_SIZE = 500 * 1024 * 1024   # 500MB for videos


class MinioService:
    def __init__(self):
        self.client = Minio(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE
        )
        self.bucket = settings.MINIO_BUCKET
        self._ensure_bucket()

    def _ensure_bucket(self):
        """Ensure bucket exists and remove any anonymous/public read policy."""
        try:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)
                logger.info(f"✅ Bucket '{self.bucket}' created")
            
            # IMPORTANT: never make application media publicly readable.
            # Remove any existing anonymous policy from older deployments.
            try:
                self.client.delete_bucket_policy(self.bucket)
                logger.info(f"🔒 Anonymous/public access disabled for bucket '{self.bucket}'")
            except S3Error as policy_error:
                # MinIO may return an error when there is no policy. That is safe:
                # the desired state is simply that no anonymous policy exists.
                logger.debug(
                    f"No anonymous bucket policy to remove for '{self.bucket}': {policy_error}"
                )
        except S3Error as e:
            logger.error(f"❌ Failed to setup bucket: {e}")
        except Exception as e:
            logger.error(f"❌ Could not reach MinIO to set up bucket '{self.bucket}': {e}")

    async def upload_file(
        self, 
        file: UploadFile, 
        folder: str = "posts",
        max_size: int = None
    ) -> dict:
        """
        Upload a file to MinIO (Memory-Efficient Streaming)
        """
        try:
            content_type = file.content_type or "application/octet-stream"

            # 1. Determine dynamic size limit if not explicitly passed
            if max_size is None:
                max_size = MAX_VIDEO_SIZE if content_type in VIDEO_TYPES else MAX_IMAGE_SIZE

            # 2. Measure file size using stream pointer (0 extra RAM used)
            file.file.seek(0, 2)
            file_size = file.file.tell()
            file.file.seek(0)  # Reset pointer to start

            # 3. Validate file size
            if file_size > max_size:
                limit_mb = max_size // (1024 * 1024)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File size exceeds {limit_mb}MB limit for {content_type}"
                )

            # 4. Generate unique filename
            file_extension = file.filename.split('.')[-1] if '.' in file.filename and file.filename else ''
            filename = f"{uuid.uuid4()}.{file_extension}" if file_extension else str(uuid.uuid4())
            object_name = f"{folder}/{filename}"
            
            # 5. Stream directly to MinIO using underlying file buffer
            self.client.put_object(
                bucket_name=self.bucket,
                object_name=object_name,
                data=file.file,
                length=file_size,
                content_type=content_type
            )
            
            # 6. Generate a temporary signed URL. The bucket itself remains private.
            url = self.get_presigned_url(
                object_name,
                settings.MINIO_PRESIGNED_URL_EXPIRY_SECONDS
            )
            if not url:
                # Avoid returning an object that the application cannot immediately access.
                try:
                    self.client.remove_object(self.bucket, object_name)
                except Exception:
                    logger.exception("Failed to roll back upload after presigned URL generation failed")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="File uploaded but a secure access URL could not be generated"
                )
            
            logger.info(f"✅ Private file uploaded: {object_name} ({file_size} bytes)")
            
            return {
                "filename": filename,
                "object_name": object_name,
                "url": url,
                "size": file_size,
                "content_type": content_type
            }
            
        except HTTPException:
            raise
        except S3Error as e:
            logger.error(f"❌ MinIO upload error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload file: {str(e)}"
            )
        except Exception as e:
            logger.error(f"❌ Upload error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Upload failed: {str(e)}"
            )

    async def upload_multiple_files(
        self, 
        files: list[UploadFile], 
        folder: str = "posts"
    ) -> list[dict]:
        """Upload multiple files to MinIO"""
        uploaded = []
        for file in files:
            result = await self.upload_file(file, folder)
            uploaded.append(result)
        return uploaded

    def delete_file(self, object_name: str) -> bool:
        """Delete a file from MinIO"""
        try:
            self.client.remove_object(self.bucket, object_name)
            logger.info(f"✅ File deleted: {object_name}")
            return True
        except S3Error as e:
            logger.error(f"❌ Delete error: {e}")
            return False

    def get_presigned_url(self, object_name: str, expiry: int = None) -> str:
        """Generate a short-lived presigned URL for a private object."""
        if expiry is None:
            expiry = settings.MINIO_PRESIGNED_URL_EXPIRY_SECONDS
        expiry = max(1, min(int(expiry), settings.MINIO_MAX_PRESIGNED_URL_EXPIRY_SECONDS))
        try:
            url = self.client.presigned_get_object(
                self.bucket,
                object_name,
                expires=timedelta(seconds=expiry)
            )
            return url
        except S3Error as e:
            logger.error(f"❌ Presigned URL error: {e}")
            return None

# Singleton instance
minio_service = MinioService()