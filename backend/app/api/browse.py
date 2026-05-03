from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from pathlib import Path
import zipfile
import io
from datetime import datetime

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.models import User, BackupJob, UserRole
from app.services.rsync_service import rsync_service

router = APIRouter()


@router.get("/backup-jobs/{job_id}/snapshots")
def list_snapshots(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all snapshots for a backup job."""
    job = db.query(BackupJob).filter(BackupJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Backup job not found")
    
    # Authorization check
    if current_user.role != UserRole.ADMIN and job.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this backup job")
    
    snapshots = rsync_service.list_snapshots(backup_uuid=job.backup_uuid)
    return {"job_id": job_id, "job_name": job.name, "snapshots": snapshots}


@router.get("/backup-jobs/{job_id}/snapshots/{snapshot_name}/browse")
def browse_snapshot(
    job_id: int,
    snapshot_name: str,
    path: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Browse files and folders in a snapshot."""
    job = db.query(BackupJob).filter(BackupJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Backup job not found")
    
    # Authorization check
    if current_user.role != UserRole.ADMIN and job.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this backup job")
    
    # Construct the full path using backup_uuid
    base_backup_dir = rsync_service.backup_root / job.backup_uuid
    snapshot_dir = base_backup_dir / snapshot_name
    
    # Verify snapshot exists
    if not snapshot_dir.exists():
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    # Verify it's a valid snapshot (has date format)
    try:
        datetime.strptime(snapshot_name[:19], '%Y-%m-%d_%H-%M-%S')
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid snapshot name")
    
    # Construct the browse path (sanitize to prevent directory traversal)
    browse_path = snapshot_dir / path.lstrip('/')
    
    # Security: ensure we're still within the snapshot directory
    try:
        browse_path = browse_path.resolve()
        snapshot_dir = snapshot_dir.resolve()
        if not str(browse_path).startswith(str(snapshot_dir)):
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    
    if not browse_path.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    
    # List directory contents
    items = []
    if browse_path.is_dir():
        try:
            for item in sorted(browse_path.iterdir()):
                relative_path = str(item.relative_to(snapshot_dir))
                item_info = {
                    "name": item.name,
                    "path": relative_path,
                    "type": "directory" if item.is_dir() else "file",
                    "size": item.stat().st_size if item.is_file() else 0,
                    "modified": datetime.fromtimestamp(item.stat().st_mtime).isoformat()
                }
                items.append(item_info)
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied")
    else:
        # If it's a file, return file info
        relative_path = str(browse_path.relative_to(snapshot_dir))
        items = [{
            "name": browse_path.name,
            "path": relative_path,
            "type": "file",
            "size": browse_path.stat().st_size,
            "modified": datetime.fromtimestamp(browse_path.stat().st_mtime).isoformat()
        }]
    
    return {
        "job_id": job_id,
        "job_name": job.name,
        "snapshot_name": snapshot_name,
        "current_path": path,
        "items": items
    }


@router.get("/backup-jobs/{job_id}/snapshots/{snapshot_name}/view")
def view_file(
    job_id: int,
    snapshot_name: str,
    path: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """View contents of a text file from a snapshot (max 10MB)."""
    MAX_VIEW_SIZE = 10 * 1024 * 1024  # 10MB limit
    
    job = db.query(BackupJob).filter(BackupJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Backup job not found")
    
    # Authorization check
    if current_user.role != UserRole.ADMIN and job.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this backup job")
    
    # Construct the full path using backup_uuid
    base_backup_dir = rsync_service.backup_root / job.backup_uuid
    snapshot_dir = base_backup_dir / snapshot_name
    file_path = snapshot_dir / path.lstrip('/')
    
    # Verify snapshot exists
    if not snapshot_dir.exists():
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    # Security: ensure we're still within the snapshot directory
    try:
        file_path = file_path.resolve()
        snapshot_dir = snapshot_dir.resolve()
        if not str(file_path).startswith(str(snapshot_dir)):
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    if not file_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    
    # Check file size
    file_size = file_path.stat().st_size
    if file_size > MAX_VIEW_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large to view (size: {file_size / 1024 / 1024:.2f}MB, max: {MAX_VIEW_SIZE / 1024 / 1024:.0f}MB)"
        )
    
    # Try to read as text
    try:
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        
        return {
            "filename": file_path.name,
            "size": file_size,
            "content": content,
            "path": path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")


@router.get("/backup-jobs/{job_id}/snapshots/{snapshot_name}/download")
def download_file(
    job_id: int,
    snapshot_name: str,
    path: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Download a single file from a snapshot."""
    job = db.query(BackupJob).filter(BackupJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Backup job not found")
    
    # Authorization check
    if current_user.role != UserRole.ADMIN and job.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this backup job")
    
    # Construct the full path using backup_uuid
    base_backup_dir = rsync_service.backup_root / job.backup_uuid
    snapshot_dir = base_backup_dir / snapshot_name
    file_path = snapshot_dir / path.lstrip('/')
    
    # Verify snapshot exists
    if not snapshot_dir.exists():
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    # Security: ensure we're still within the snapshot directory
    try:
        file_path = file_path.resolve()
        snapshot_dir = snapshot_dir.resolve()
        if not str(file_path).startswith(str(snapshot_dir)):
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    if not file_path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    
    # Return file
    try:
        with open(file_path, 'rb') as f:
            content = f.read()
        
        return Response(
            content=content,
            media_type='application/octet-stream',
            headers={
                'Content-Disposition': f'attachment; filename="{file_path.name}"'
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")


@router.get("/backup-jobs/{job_id}/snapshots/{snapshot_name}/download-zip")
def download_folder_zip(
    job_id: int,
    snapshot_name: str,
    path: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Download a folder as a zip file."""
    job = db.query(BackupJob).filter(BackupJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Backup job not found")
    
    # Authorization check
    if current_user.role != UserRole.ADMIN and job.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this backup job")
    
    # Construct the full path using backup_uuid
    base_backup_dir = rsync_service.backup_root / job.backup_uuid
    snapshot_dir = base_backup_dir / snapshot_name
    folder_path = snapshot_dir / path.lstrip('/') if path else snapshot_dir
    
    # Verify snapshot exists
    if not snapshot_dir.exists():
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    # Security: ensure we're still within the snapshot directory
    try:
        folder_path = folder_path.resolve()
        snapshot_dir = snapshot_dir.resolve()
        if not str(folder_path).startswith(str(snapshot_dir)):
            raise HTTPException(status_code=403, detail="Access denied")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid path")
    
    if not folder_path.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    
    if not folder_path.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")
    
    # Create zip file in memory
    zip_buffer = io.BytesIO()
    try:
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for root, dirs, files in os.walk(folder_path):
                for file in files:
                    file_path = Path(root) / file
                    arcname = file_path.relative_to(folder_path)
                    try:
                        zip_file.write(file_path, arcname)
                    except Exception:
                        # Skip files that can't be read
                        pass
        
        zip_buffer.seek(0)
        zip_filename = f"{folder_path.name}_{snapshot_name}.zip" if path else f"{job.name}_{snapshot_name}.zip"
        
        return Response(
            content=zip_buffer.getvalue(),
            media_type='application/zip',
            headers={
                'Content-Disposition': f'attachment; filename="{zip_filename}"'
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating zip: {str(e)}")
