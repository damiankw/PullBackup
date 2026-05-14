from fastapi import APIRouter, Depends, HTTPException, Response, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from pathlib import Path
import zipfile
import io
from datetime import datetime

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.models import User, BackupJob, UserRole, Snapshot, AuditAction
from app.services.rsync_service import rsync_service
from app.services.audit_service import audit_service

router = APIRouter()


def _check_directory_for_changes(current_dir: Path, previous_dir: Path, max_depth: int = 10) -> Optional[str]:
    """
    Recursively check if a directory contains any new or modified files.
    
    Args:
        current_dir: Current snapshot directory to check
        previous_dir: Previous snapshot directory to compare against
        max_depth: Maximum recursion depth to prevent infinite loops
        
    Returns:
        "new" if directory or any content is new
        "modified" if any content is modified
        None if no changes detected
    """
    if max_depth <= 0:
        return None
    
    # Check if the directory itself is new
    if not previous_dir.exists():
        return "new"
    
    has_modified = False
    
    try:
        for item in current_dir.iterdir():
            previous_item = previous_dir / item.name
            
            # If item doesn't exist in previous snapshot, it's new
            if not previous_item.exists():
                return "new"  # Immediately return "new" if we find any new items
            
            if item.is_file():
                # Compare inode numbers for files
                try:
                    current_stat = item.stat()
                    previous_stat = previous_item.stat()
                    
                    if current_stat.st_ino != previous_stat.st_ino:
                        has_modified = True
                        # Don't return yet, keep checking for "new" items
                except (OSError, PermissionError):
                    pass
            elif item.is_dir():
                # Recursively check subdirectory
                subdir_status = _check_directory_for_changes(item, previous_item, max_depth - 1)
                if subdir_status == "new":
                    return "new"  # Propagate "new" immediately
                elif subdir_status == "modified":
                    has_modified = True
    except (OSError, PermissionError):
        pass
    
    return "modified" if has_modified else None


@router.get("/backup-jobs/{job_id}/snapshots")
def list_snapshots(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all snapshots for a backup job (cached from database for speed)."""
    job = db.query(BackupJob).filter(BackupJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Backup job not found")
    
    # Authorization check
    if current_user.role != UserRole.ADMIN and job.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this backup job")
    
    # Query snapshots from database (fast!)
    db_snapshots = db.query(Snapshot).filter(
        Snapshot.backup_job_id == job_id
    ).order_by(Snapshot.created_at.desc()).all()
    
    # Check if there are snapshots on disk that aren't in the database
    base_backup_dir = rsync_service.backup_root / job.backup_uuid
    disk_snapshots = set()
    
    if base_backup_dir.exists():
        for item in base_backup_dir.iterdir():
            if item.is_dir():
                try:
                    # Verify it's a valid snapshot directory
                    datetime.strptime(item.name[:19], '%Y-%m-%d_%H-%M-%S')
                    disk_snapshots.add(item.name)
                except (ValueError, IndexError):
                    continue
    
    # Get snapshot names from database
    db_snapshot_names = {snap.name for snap in db_snapshots}
    
    # Find snapshots on disk that aren't in database (e.g., old backups from before this feature)
    missing_snapshots = disk_snapshots - db_snapshot_names
    
    # Index missing snapshots (calculate their sizes and save to database)
    if missing_snapshots:
        for snapshot_name in missing_snapshots:
            try:
                snapshot_path = base_backup_dir / snapshot_name
                snapshot_created_at = datetime.strptime(snapshot_name[:19], '%Y-%m-%d_%H-%M-%S')
                
                # For old snapshots, we only calculate logical size (total)
                # We can't determine incremental size without rsync stats
                size_info = rsync_service._calculate_snapshot_size(snapshot_path)
                
                # Save to database
                # Note: size_bytes is 0 for old snapshots (no rsync stats available)
                # logical_size_bytes is the total size of all files in the snapshot
                snapshot = Snapshot(
                    backup_job_id=job_id,
                    name=snapshot_name,
                    created_at=snapshot_created_at,
                    size_bytes=0,  # Can't determine incremental size for old snapshots
                    logical_size_bytes=size_info['snapshot_total_size_bytes'],
                    file_count=0  # We don't have file count for old snapshots
                )
                db.add(snapshot)
                db_snapshots.append(snapshot)
            except Exception as e:
                # Skip snapshots that can't be indexed
                print(f"Failed to index snapshot {snapshot_name}: {e}")
                continue
        
        # Commit all new snapshots
        try:
            db.commit()
        except Exception as e:
            print(f"Failed to commit snapshot metadata: {e}")
            db.rollback()
    
    # Build response from database snapshots
    snapshots_list = []
    total_actual_size = 0
    total_logical_size = 0
    
    for snap in db_snapshots:
        snapshots_list.append({
            'name': snap.name,
            'date': snap.created_at.isoformat(),
            'path': str(base_backup_dir / snap.name),
            'size_bytes': snap.size_bytes,
            'logical_size_bytes': snap.logical_size_bytes,
        })
        total_actual_size += snap.size_bytes
        total_logical_size += snap.logical_size_bytes
    
    # Sort by date, newest first
    snapshots_list.sort(key=lambda x: x['date'], reverse=True)
    
    total_space_saved = total_logical_size - total_actual_size if total_logical_size > total_actual_size else 0
    
    return {
        "job_id": job_id,
        "job_name": job.name,
        "snapshots": snapshots_list,
        "total_actual_size_bytes": total_actual_size,
        "total_logical_size_bytes": total_logical_size,
        "total_space_saved_bytes": total_space_saved,
    }


@router.get("/backup-jobs/{job_id}/snapshots/{snapshot_name}/browse")
def browse_snapshot(
    job_id: int,
    snapshot_name: str,
    path: str = "",
    compare: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Browse files and folders in a snapshot with optional change detection."""
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
    
    # Get all snapshots sorted by date to find previous snapshot
    all_snapshots = []
    if base_backup_dir.exists():
        for item in base_backup_dir.iterdir():
            if item.is_dir():
                try:
                    datetime.strptime(item.name[:19], '%Y-%m-%d_%H-%M-%S')
                    all_snapshots.append(item.name)
                except (ValueError, IndexError):
                    continue
    
    all_snapshots.sort()
    
    # Find the snapshot just before the current one
    previous_snapshot_dir = None
    has_previous_snapshot = False
    try:
        current_index = all_snapshots.index(snapshot_name)
        if current_index > 0:
            previous_snapshot_dir = base_backup_dir / all_snapshots[current_index - 1]
            has_previous_snapshot = True
            # Only use previous snapshot for comparison if compare flag is enabled
            if not compare:
                previous_snapshot_dir = None
    except ValueError:
        pass
    
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
                item_stat = item.stat()
                
                # Determine change status if comparison is enabled
                change_status = None
                if compare and previous_snapshot_dir:
                    previous_item_path = previous_snapshot_dir / relative_path
                    if not previous_item_path.exists():
                        change_status = "new"
                    elif item.is_file():
                        # Compare inode numbers to detect changes in hardlinked backups
                        # If inodes are different, the file was modified (rsync created a new file)
                        # If inodes are the same, the file is hardlinked (unchanged)
                        try:
                            previous_stat = previous_item_path.stat()
                            current_inode = item_stat.st_ino
                            previous_inode = previous_stat.st_ino
                            
                            # Different inodes = file was modified
                            if current_inode != previous_inode:
                                change_status = "modified"
                        except (OSError, PermissionError):
                            pass  # If we can't stat previous file, skip comparison
                    elif item.is_dir():
                        # For directories, recursively check if they contain any changes
                        change_status = _check_directory_for_changes(item, previous_item_path)
                
                item_info = {
                    "name": item.name,
                    "path": relative_path,
                    "type": "directory" if item.is_dir() else "file",
                    "size": item_stat.st_size if item.is_file() else 0,
                    "modified": datetime.fromtimestamp(item_stat.st_mtime).isoformat(),
                    "change_status": change_status
                }
                items.append(item_info)
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied")
    else:
        # If it's a file, return file info
        relative_path = str(browse_path.relative_to(snapshot_dir))
        item_stat = browse_path.stat()
        
        change_status = None
        if compare and previous_snapshot_dir:
            previous_file_path = previous_snapshot_dir / relative_path
            if not previous_file_path.exists():
                change_status = "new"
            else:
                # Compare inode numbers to detect changes
                try:
                    previous_stat = previous_file_path.stat()
                    current_inode = item_stat.st_ino
                    previous_inode = previous_stat.st_ino
                    
                    if current_inode != previous_inode:
                        change_status = "modified"
                except (OSError, PermissionError):
                    pass
        
        items = [{
            "name": browse_path.name,
            "path": relative_path,
            "type": "file",
            "size": item_stat.st_size,
            "modified": datetime.fromtimestamp(item_stat.st_mtime).isoformat(),
            "change_status": change_status
        }]
    
    return {
        "job_id": job_id,
        "job_name": job.name,
        "snapshot_name": snapshot_name,
        "current_path": path,
        "items": items,
        "has_previous_snapshot": has_previous_snapshot
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
    request: Request,
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
    
    # Log audit event
    audit_service.log_from_request(
        db=db,
        request=request,
        action=AuditAction.DOWNLOAD,
        user=current_user,
        resource_type="file",
        resource_id=job_id,
        resource_name=file_path.name,
        description=f"Downloaded file '{path}' from snapshot '{snapshot_name}' of backup job '{job.name}'"
    )
    
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
    request: Request = None,
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
    
    # Log audit event
    if request:
        audit_service.log_from_request(
            db=db,
            request=request,
            action=AuditAction.DOWNLOAD,
            user=current_user,
            resource_type="folder",
            resource_id=job_id,
            resource_name=folder_path.name or snapshot_name,
            description=f"Downloaded folder '{path or '/'}' as ZIP from snapshot '{snapshot_name}' of backup job '{job.name}'"
        )
    
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
