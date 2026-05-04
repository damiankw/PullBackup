from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.models import User, BackupHistory, BackupJob, Server
from app.schemas.schemas import BackupHistory as BackupHistorySchema

router = APIRouter()


@router.get("/", response_model=List[BackupHistorySchema])
def list_backup_history(
    skip: int = 0,
    limit: int = 100,
    backup_job_id: Optional[int] = None,
    server_id: Optional[int] = None,
    status: Optional[str] = None,
    started_from: Optional[datetime] = None,
    started_to: Optional[datetime] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List backup history with optional filtering."""
    query = db.query(BackupHistory).join(BackupJob).options(
        joinedload(BackupHistory.backup_job).joinedload(BackupJob.server)
    )
    
    # Admin can see all history, regular users see only their own
    if current_user.role.value != 'admin':
        query = query.filter(BackupJob.owner_id == current_user.id)
    
    # Filter by backup job if specified
    if backup_job_id is not None:
        query = query.filter(BackupHistory.backup_job_id == backup_job_id)
    
    # Filter by server if specified
    if server_id is not None:
        query = query.filter(BackupJob.server_id == server_id)
    
    # Filter by status if specified
    if status is not None:
        query = query.filter(BackupHistory.status == status)
    
    # Filter by date range if specified
    if started_from is not None:
        query = query.filter(BackupHistory.started_at >= started_from)
    
    if started_to is not None:
        query = query.filter(BackupHistory.started_at <= started_to)
    
    # Order by most recent first
    history = query.order_by(BackupHistory.created_at.desc()).offset(skip).limit(limit).all()
    return history


@router.get("/{history_id}", response_model=BackupHistorySchema)
def get_backup_history(
    history_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get backup history entry by ID."""
    history = db.query(BackupHistory).join(BackupJob).filter(
        BackupHistory.id == history_id
    ).first()
    
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup history not found"
        )
    
    # Check ownership
    if history.backup_job.owner_id != current_user.id and current_user.role.value != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this backup history"
        )
    
    return history


@router.delete("/{history_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_backup_history(
    history_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete backup history entry."""
    history = db.query(BackupHistory).join(BackupJob).filter(
        BackupHistory.id == history_id
    ).first()
    
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup history not found"
        )
    
    # Check ownership
    if history.backup_job.owner_id != current_user.id and current_user.role.value != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this backup history"
        )
    
    db.delete(history)
    db.commit()
    
    return None
