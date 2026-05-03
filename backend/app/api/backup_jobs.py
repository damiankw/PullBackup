from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.models import User, BackupJob, BackupHistory, BackupStatus, Server
from app.schemas.schemas import (
    BackupJobCreate, BackupJobUpdate, BackupJob as BackupJobSchema,
    BackupJobWithHistory
)
from app.services.scheduler import backup_scheduler
from app.services.rsync_service import rsync_service

router = APIRouter()


@router.get("/", response_model=List[BackupJobSchema])
def list_backup_jobs(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all backup jobs for current user."""
    query = db.query(BackupJob).options(joinedload(BackupJob.server))
    
    # Admin can see all jobs, regular users see only their own
    if current_user.role.value != 'admin':
        query = query.filter(BackupJob.owner_id == current_user.id)
    
    jobs = query.offset(skip).limit(limit).all()
    return jobs


@router.post("/", response_model=BackupJobSchema, status_code=status.HTTP_201_CREATED)
def create_backup_job(
    job_data: BackupJobCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new backup job."""
    # Verify server exists and user has access
    server = db.query(Server).filter(Server.id == job_data.server_id).first()
    
    if not server:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Server not found"
        )
    
    if server.owner_id != current_user.id and current_user.role.value != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to use this server"
        )
    
    # Create backup job
    backup_job = BackupJob(**job_data.dict(), owner_id=current_user.id)
    db.add(backup_job)
    db.commit()
    db.refresh(backup_job)
    
    # Schedule if schedule is provided
    if backup_job.schedule and backup_job.schedule.strip():
        success = backup_scheduler.add_job(backup_job.id, backup_job.schedule)
        if success:
            backup_job.next_run = backup_scheduler.get_next_run_time(backup_job.id)
            db.commit()
            db.refresh(backup_job)
    
    return backup_job


@router.get("/{job_id}", response_model=BackupJobWithHistory)
def get_backup_job(
    job_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get backup job by ID."""
    job = db.query(BackupJob).filter(BackupJob.id == job_id).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup job not found"
        )
    
    # Check ownership
    if job.owner_id != current_user.id and current_user.role.value != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this backup job"
        )
    
    return job


@router.put("/{job_id}", response_model=BackupJobSchema)
def update_backup_job(
    job_id: int,
    job_data: BackupJobUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update backup job."""
    job = db.query(BackupJob).filter(BackupJob.id == job_id).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup job not found"
        )
    
    # Check ownership
    if job.owner_id != current_user.id and current_user.role.value != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this backup job"
        )
    
    # Verify server if being updated
    if job_data.server_id is not None:
        server = db.query(Server).filter(Server.id == job_data.server_id).first()
        if not server:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Server not found"
            )
        if server.owner_id != current_user.id and current_user.role.value != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to use this server"
            )
    
    # Update fields
    schedule_updated = False
    for field, value in job_data.dict(exclude_unset=True).items():
        if field == 'schedule' and value != job.schedule:
            schedule_updated = True
        setattr(job, field, value)
    
    db.commit()
    db.refresh(job)
    
    # Update schedule if changed
    if schedule_updated:
        backup_scheduler.remove_job(job.id)
        if job.schedule and job.schedule.strip() and job.is_active:
            success = backup_scheduler.add_job(job.id, job.schedule)
            if success:
                job.next_run = backup_scheduler.get_next_run_time(job.id)
                db.commit()
                db.refresh(job)
        else:
            job.next_run = None
            db.commit()
            db.refresh(job)
    elif not job.is_active:
        # Remove from scheduler if deactivated
        backup_scheduler.remove_job(job.id)
        job.next_run = None
        db.commit()
        db.refresh(job)
    
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_backup_job(
    job_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete backup job."""
    job = db.query(BackupJob).filter(BackupJob.id == job_id).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup job not found"
        )
    
    # Check ownership
    if job.owner_id != current_user.id and current_user.role.value != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this backup job"
        )
    
    # Remove from scheduler
    backup_scheduler.remove_job(job.id)
    
    # Delete job
    db.delete(job)
    db.commit()
    
    return None


@router.post("/{job_id}/run")
async def run_backup_job(
    job_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Manually trigger a backup job."""
    job = db.query(BackupJob).filter(BackupJob.id == job_id).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Backup job not found"
        )
    
    # Check ownership
    if job.owner_id != current_user.id and current_user.role.value != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to run this backup job"
        )
    
    # Check if there's already a running backup for this job
    running = db.query(BackupHistory).filter(
        BackupHistory.backup_job_id == job_id,
        BackupHistory.status == BackupStatus.RUNNING
    ).first()
    
    if running:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Backup is already running for this job"
        )
    
    # Create history entry
    history = BackupHistory(
        backup_job_id=job_id,
        status=BackupStatus.PENDING,
        triggered_by='manual'
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    
    # Execute backup in background
    background_tasks.add_task(
        execute_backup,
        job_id=job_id,
        history_id=history.id
    )
    
    return {
        "message": "Backup started",
        "history_id": history.id
    }


def execute_backup(job_id: int, history_id: int):
    """Execute backup (called as background task)."""
    db = SessionLocal()
    try:
        # Get backup job and history
        job = db.query(BackupJob).filter(BackupJob.id == job_id).first()
        history = db.query(BackupHistory).filter(BackupHistory.id == history_id).first()
        
        if not job or not history:
            return
        
        # Update history status
        history.status = BackupStatus.RUNNING
        history.started_at = datetime.now()
        db.commit()
        
        # Get server info
        server = job.server
        ssh_key_path = server.ssh_key.key_file_path if server.ssh_key else None
        
        # Execute backup
        success, log_output, stats = rsync_service.execute_backup(
            hostname=server.hostname,
            port=server.port,
            username=server.username,
            remote_path=job.remote_path,
            ssh_key_path=ssh_key_path,
            rsync_options=job.rsync_options,
            backup_uuid=job.backup_uuid,
            job_name=job.name,
            server_name=server.name
        )
        
        # Generate/update README.md after backup
        if success:
            rsync_service.generate_readme(
                backup_uuid=job.backup_uuid,
                job_name=job.name,
                server_name=server.name,
                hostname=server.hostname,
                port=server.port,
                username=server.username,
                remote_path=job.remote_path,
                schedule=job.schedule,
                rsync_options=job.rsync_options
            )
        
        # Update history
        history.status = BackupStatus.SUCCESS if success else BackupStatus.FAILED
        history.completed_at = datetime.now()
        history.log_output = log_output
        history.bytes_transferred = stats.get('bytes_transferred', 0)
        history.files_transferred = stats.get('files_transferred', 0)
        history.snapshot_size_bytes = stats.get('snapshot_size_bytes', 0)
        history.snapshot_total_size_bytes = stats.get('snapshot_total_size_bytes', 0)
        history.space_saved_bytes = stats.get('space_saved_bytes', 0)
        
        if not success:
            history.error_message = "Backup failed - check logs for details"
        
        # Update backup job
        job.last_run = datetime.now()
        
        db.commit()
        
    except Exception as e:
        if history:
            history.status = BackupStatus.FAILED
            history.completed_at = datetime.now()
            history.error_message = str(e)
            db.commit()
    finally:
        db.close()


# Import SessionLocal for background task
from app.core.database import SessionLocal
