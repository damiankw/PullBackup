from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.models import User, Server, BackupJob, BackupHistory, BackupStatus
from app.schemas.schemas import Stats

router = APIRouter()


@router.get("/stats", response_model=Stats)
def get_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get dashboard statistics."""
    # Build base queries with ownership filter
    if current_user.role.value != 'admin':
        servers_query = db.query(Server).filter(Server.owner_id == current_user.id)
        jobs_query = db.query(BackupJob).filter(BackupJob.owner_id == current_user.id)
        history_query = db.query(BackupHistory).join(BackupJob).filter(
            BackupJob.owner_id == current_user.id
        )
    else:
        servers_query = db.query(Server)
        jobs_query = db.query(BackupJob)
        history_query = db.query(BackupHistory)
    
    # Count totals
    total_servers = servers_query.count()
    total_backup_jobs = jobs_query.count()
    total_backups = history_query.count()
    
    # Count by status
    successful_backups = history_query.filter(
        BackupHistory.status == BackupStatus.SUCCESS
    ).count()
    
    failed_backups = history_query.filter(
        BackupHistory.status == BackupStatus.FAILED
    ).count()
    
    running_backups = history_query.filter(
        BackupHistory.status == BackupStatus.RUNNING
    ).count()
    
    return {
        "total_servers": total_servers,
        "total_backup_jobs": total_backup_jobs,
        "total_backups": total_backups,
        "successful_backups": successful_backups,
        "failed_backups": failed_backups,
        "running_backups": running_backups
    }
