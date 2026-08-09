# backend/app/api/v1/endpoints/media.py
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.user import User
from app.storage.minio import minio_service
from typing import List

router = APIRouter()

# Allowed file types
ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'
]

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

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
    
    # Validate files
    for file in files:
        if file.content_type not in ALLOWED_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type '{file.content_type}' not allowed. Allowed: {', '.join(ALLOWED_TYPES)}"
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
    current_user: User = Depends(get_current_user)
):
    """Delete a media file from MinIO"""
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
    expiry: int = 3600,
    current_user: User = Depends(get_current_user)
):
    """Get a presigned URL for temporary access to a private file"""
    url = minio_service.get_presigned_url(object_name, expiry)
    if not url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found"
        )
    return {"url": url}