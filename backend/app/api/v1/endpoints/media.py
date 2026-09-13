# backend/app/api/v1/endpoints/media.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.dependencies.auth import get_current_user, get_current_admin_user
from app.models.user import User
from app.storage.minio import minio_service
from app.core.config import settings
from typing import List

router = APIRouter()

# Categorized Allowed File Types
VIDEO_TYPES = {
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
}

IMAGE_AND_DOC_TYPES = {
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'application/msword', 'text/plain', 'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

ALLOWED_TYPES = list(VIDEO_TYPES | IMAGE_AND_DOC_TYPES)

# File Size Limits
MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024   # 10MB limit for images & docs
MAX_VIDEO_FILE_SIZE = 500 * 1024 * 1024  # 500MB limit for videos

# ============================================
# UPLOAD MEDIA
# ============================================

@router.post("/upload")
async def upload_media(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload one or more media files to MinIO
    Returns URLs for the uploaded files
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided"
        )
    
    # Validate file types and size limits
    for file in files:
        if file.content_type not in ALLOWED_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type '{file.content_type}' not allowed. Allowed: {', '.join(ALLOWED_TYPES)}"
            )
        
        # Determine maximum allowed size based on file category
        if file.content_type in VIDEO_TYPES:
            max_limit = MAX_VIDEO_FILE_SIZE
            limit_label = "500MB"
        else:
            max_limit = MAX_IMAGE_FILE_SIZE
            limit_label = "10MB"

        # Check file size safely using file descriptor offset (low RAM usage)
        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)  # Reset cursor for downstream MinIO processing

        if file_size > max_limit:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File '{file.filename}' exceeds the {limit_label} limit for {file.content_type}."
            )
    
    try:
        # Upload to MinIO
        uploaded = await minio_service.upload_multiple_files(files, "posts")
        
        return {
            "urls": [item["url"] for item in uploaded],
            "files": uploaded
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )

# ============================================
# DELETE MEDIA
# ============================================

@router.delete("/{object_name:path}")
async def delete_media(
    object_name: str,
    current_user: User = Depends(get_current_admin_user)
):
    """Delete a media file from MinIO. Admin-only: uploads don't record who
    uploaded what, so there's no ownership check possible - restricting to
    admin closes the IDOR without a schema change. Not used anywhere in the
    current frontend (uploads are otherwise never deleted by users)."""
    success = minio_service.delete_file(object_name)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    return {"message": "File deleted successfully"}

# ============================================
# GET PRESIGNED URL
# ============================================

@router.get("/presigned/{object_name:path}")
async def get_presigned_url(
    object_name: str,
    current_user: User = Depends(get_current_user)
):
    """Get a short-lived presigned URL for a private file.

    IMPORTANT: this endpoint is authentication-gated and the client cannot
    choose an unlimited expiry. Object-level authorization should be added
    here once media ownership/resource relationships are persisted.
    """
    url = minio_service.get_presigned_url(
        object_name,
        settings.MINIO_PRESIGNED_URL_EXPIRY_SECONDS
    )
    if not url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    return {"url": url}