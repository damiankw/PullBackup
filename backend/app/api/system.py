from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import os
import shutil
import psutil
from datetime import datetime, timedelta
from croniter import croniter
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.core.config import settings
from app.models.models import User, UserRole, BackupJob, BackupHistory, Server, SSHKey, SystemSettings
from app.services.scheduler import backup_scheduler

router = APIRouter()


@router.get("/info")
def get_system_info(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get system information and statistics (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get database file size
    db_path = "data/pullbackup.db"
    db_size = 0
    if os.path.exists(db_path):
        db_size = os.path.getsize(db_path)
    
    # Get backup storage info
    backup_path = settings.BACKUP_ROOT_DIR
    storage_total = 0
    storage_used = 0
    storage_free = 0
    
    try:
        if os.path.exists(backup_path):
            stat = shutil.disk_usage(backup_path)
            storage_total = stat.total
            storage_used = stat.used
            storage_free = stat.free
    except Exception as e:
        print(f"Error getting storage info: {e}")
    
    # Count entities
    total_users = db.query(User).count()
    total_servers = db.query(Server).count()
    total_ssh_keys = db.query(SSHKey).count()
    total_backup_jobs = db.query(BackupJob).count()
    active_backup_jobs = db.query(BackupJob).filter(BackupJob.is_active == True).count()
    total_backups = db.query(BackupHistory).count()
    
    # Recent backups (last 24 hours)
    yesterday = datetime.utcnow() - timedelta(days=1)
    recent_backups = db.query(BackupHistory).filter(
        BackupHistory.started_at >= yesterday
    ).count()
    
    # Success rate
    successful_backups = db.query(BackupHistory).filter(
        BackupHistory.status == 'success'
    ).count()
    
    success_rate = 0
    if total_backups > 0:
        success_rate = (successful_backups / total_backups) * 100
    
    # Failed backups
    failed_backups = db.query(BackupHistory).filter(
        BackupHistory.status == 'failed'
    ).count()
    
    # Get scheduler status (approximation - check if there are scheduled jobs)
    scheduled_jobs = db.query(BackupJob).filter(
        BackupJob.is_active == True,
        BackupJob.schedule != None,
        BackupJob.schedule != ''
    ).count()
    
    # Get system uptime and CPU/memory (if available)
    try:
        cpu_percent = psutil.cpu_percent(interval=1)
        memory = psutil.virtual_memory()
        memory_percent = memory.percent
    except:
        cpu_percent = None
        memory_percent = None
    
    return {
        "version": "1.0.0",
        "database": {
            "size": db_size,
            "size_mb": round(db_size / (1024 * 1024), 2)
        },
        "storage": {
            "total": storage_total,
            "used": storage_used,
            "free": storage_free,
            "total_gb": round(storage_total / (1024**3), 2),
            "used_gb": round(storage_used / (1024**3), 2),
            "free_gb": round(storage_free / (1024**3), 2),
            "used_percent": round((storage_used / storage_total * 100), 2) if storage_total > 0 else 0
        },
        "entities": {
            "users": total_users,
            "servers": total_servers,
            "ssh_keys": total_ssh_keys,
            "backup_jobs": total_backup_jobs,
            "active_jobs": active_backup_jobs
        },
        "backups": {
            "total": total_backups,
            "recent_24h": recent_backups,
            "successful": successful_backups,
            "failed": failed_backups,
            "success_rate": round(success_rate, 2)
        },
        "scheduler": {
            "scheduled_jobs": scheduled_jobs,
            "status": "running" if scheduled_jobs > 0 else "idle"
        },
        "system": {
            "cpu_percent": cpu_percent,
            "memory_percent": memory_percent
        }
    }


@router.get("/storage-stats")
def get_storage_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get detailed storage statistics by backup job."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    backup_path = settings.BACKUP_ROOT_DIR
    job_stats = []
    
    if os.path.exists(backup_path):
        # Get all backup job UUIDs
        jobs = db.query(BackupJob).all()
        
        for job in jobs:
            job_backup_path = os.path.join(backup_path, job.backup_uuid)
            size = 0
            snapshot_count = 0
            
            if os.path.exists(job_backup_path):
                # Count snapshots
                try:
                    snapshots = [d for d in os.listdir(job_backup_path) 
                                if os.path.isdir(os.path.join(job_backup_path, d))]
                    snapshot_count = len(snapshots)
                    
                    # Calculate total size
                    for dirpath, dirnames, filenames in os.walk(job_backup_path):
                        for filename in filenames:
                            filepath = os.path.join(dirpath, filename)
                            try:
                                size += os.path.getsize(filepath)
                            except:
                                pass
                except Exception as e:
                    print(f"Error processing job {job.name}: {e}")
            
            job_stats.append({
                "id": job.id,
                "name": job.name,
                "uuid": job.backup_uuid,
                "size": size,
                "size_gb": round(size / (1024**3), 2),
                "snapshot_count": snapshot_count
            })
    
    # Sort by size descending
    job_stats.sort(key=lambda x: x['size'], reverse=True)
    
    return {
        "jobs": job_stats,
        "total_size": sum(j['size'] for j in job_stats),
        "total_size_gb": round(sum(j['size'] for j in job_stats) / (1024**3), 2),
        "total_snapshots": sum(j['snapshot_count'] for j in job_stats)
    }


@router.post("/reload-scheduler")
def reload_scheduler(
    current_user: User = Depends(get_current_active_user)
):
    """Reload all scheduled backup jobs from database (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        backup_scheduler.reload_all_jobs()
        return {
            "message": "Scheduler reloaded successfully",
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to reload scheduler: {str(e)}"
        )


@router.get("/health-check")
def health_check(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Check for backup health issues including missed scheduled backups.
    Detects when scheduled backups should have run but didn't create history records.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    issues = []
    warnings = []
    now = datetime.now()

    # Check for stuck RUNNING jobs
    stuck_threshold = now - timedelta(hours=6)
    stuck_jobs = db.query(BackupHistory).filter(
        BackupHistory.status == 'RUNNING',
        BackupHistory.started_at < stuck_threshold
    ).all()
    
    for stuck in stuck_jobs:
        job = db.query(BackupJob).filter(BackupJob.id == stuck.backup_job_id).first()
        hours_stuck = (now - stuck.started_at).total_seconds() / 3600
        
        issues.append({
            "type": "stuck_running",
            "severity": "critical",
            "job_id": stuck.backup_job_id,
            "job_name": job.name if job else f"Job {stuck.backup_job_id}",
            "history_id": stuck.id,
            "message": f"Backup job '{job.name if job else stuck.backup_job_id}' has been stuck in RUNNING state for {hours_stuck:.1f} hours since {stuck.started_at.strftime('%Y-%m-%d %H:%M:%S')}.",
            "started_at": stuck.started_at.isoformat(),
            "hours_stuck": round(hours_stuck, 1),
            "suggestion": "This backup likely hung due to storage becoming unavailable. Reload the scheduler from Settings to clean up stuck jobs."
        })
    
    # Check for active jobs with schedules
    active_jobs = db.query(BackupJob).filter(
        BackupJob.is_active == True,
        BackupJob.schedule.isnot(None)
    ).all()

    for job in active_jobs:
        # Get next run time from scheduler
        next_run = backup_scheduler.get_next_run_time(job.id)
        
        if not next_run and job.last_run:
            # Job is scheduled but not in scheduler - possible issue
            warnings.append({
                "type": "job_not_scheduled",
                "severity": "warning",
                "job_id": job.id,
                "job_name": job.name,
                "message": f"Job '{job.name}' is marked as active with schedule '{job.schedule}' but is not in the scheduler. Last run: {job.last_run}",
                "suggestion": "Try reloading the scheduler from System Info page."
            })
        
        # Check for missed backups (no history in expected time window)
        if job.last_run:
            # Parse cron schedule to estimate expected interval
            from croniter import croniter
            try:
                cron = croniter(job.schedule, job.last_run)
                expected_next_run = cron.get_next(datetime)
                
                # If we're past the expected next run by more than 1 hour, and no recent history
                if now > expected_next_run + timedelta(hours=1):
                    # Check if there's a history record after the expected next run
                    recent_history = db.query(BackupHistory).filter(
                        BackupHistory.backup_job_id == job.id,
                        BackupHistory.started_at >= expected_next_run
                    ).first()
                    
                    if not recent_history:
                        time_since_last = now - job.last_run
                        hours_overdue = (now - expected_next_run).total_seconds() / 3600
                        
                        issues.append({
                            "type": "missed_backup",
                            "severity": "critical" if hours_overdue > 24 else "warning",
                            "job_id": job.id,
                            "job_name": job.name,
                            "message": f"Job '{job.name}' has not run since {job.last_run.strftime('%Y-%m-%d %H:%M:%S')} ({time_since_last.days} days, {time_since_last.seconds // 3600} hours ago). Expected to run at {expected_next_run.strftime('%Y-%m-%d %H:%M:%S')}.",
                            "last_run": job.last_run.isoformat(),
                            "expected_next_run": expected_next_run.isoformat(),
                            "hours_overdue": round(hours_overdue, 1),
                            "suggestion": "Check if storage is available and scheduler is running. Try manually executing the backup."
                        })
            except Exception as cron_error:
                warnings.append({
                    "type": "invalid_schedule",
                    "severity": "warning",
                    "job_id": job.id,
                    "job_name": job.name,
                    "message": f"Cannot parse schedule '{job.schedule}' for job '{job.name}': {str(cron_error)}",
                    "suggestion": "Check the cron expression format."
                })
        elif job.schedule:
            # Job has never run but has a schedule
            warnings.append({
                "type": "never_run",
                "severity": "info",
                "job_id": job.id,
                "job_name": job.name,
                "message": f"Job '{job.name}' is scheduled but has never run.",
                "next_run": next_run.isoformat() if next_run else None,
                "suggestion": "Job will run at next scheduled time or can be triggered manually."
            })
    
    # Check for consecutive failures
    for job in active_jobs:
        # Get last 3 backup attempts
        recent_attempts = db.query(BackupHistory).filter(
            BackupHistory.backup_job_id == job.id
        ).order_by(BackupHistory.started_at.desc()).limit(3).all()
        
        if len(recent_attempts) >= 3:
            all_failed = all(h.status == 'FAILED' for h in recent_attempts)
            if all_failed:
                issues.append({
                    "type": "consecutive_failures",
                    "severity": "critical",
                    "job_id": job.id,
                    "job_name": job.name,
                    "message": f"Job '{job.name}' has failed the last {len(recent_attempts)} consecutive attempts.",
                    "last_error": recent_attempts[0].error_message if recent_attempts[0].error_message else "No error message",
                    "suggestion": "Check error logs and verify server connectivity and storage availability."
                })
    
    # Check storage availability
    backup_path = settings.BACKUP_ROOT_DIR
    storage_available = True
    storage_error = None
    
    try:
        if os.path.exists(backup_path):
            # Try to create a test file
            test_file = os.path.join(backup_path, ".health_check")
            with open(test_file, 'w') as f:
                f.write("health check")
            os.remove(test_file)
        else:
            storage_available = False
            storage_error = "Backup path does not exist"
    except Exception as e:
        storage_available = False
        storage_error = str(e)
    
    if not storage_available:
        issues.append({
            "type": "storage_unavailable",
            "severity": "critical",
            "message": f"Backup storage at {backup_path} is not available: {storage_error}",
            "suggestion": "Check if NAS is mounted and accessible. Backups will fail until storage is restored."
        })
    
    return {
        "status": "healthy" if len(issues) == 0 else "degraded" if len([i for i in issues if i['severity'] == 'critical']) == 0 else "unhealthy",
        "timestamp": now.isoformat(),
        "issues": issues,
        "warnings": warnings,
        "total_issues": len(issues),
        "total_warnings": len(warnings),
        "critical_count": len([i for i in issues if i['severity'] == 'critical']),
        "active_jobs_checked": len(active_jobs)
    }


class BackupDirUpdate(BaseModel):
    backup_dir: str


@router.get("/backup-dir")
def get_backup_dir(
    current_user: User = Depends(get_current_active_user),
):
    """Get current backup root directory."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return {"backup_dir": settings.BACKUP_ROOT_DIR}


@router.put("/backup-dir")
def update_backup_dir(
    data: BackupDirUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Update backup root directory."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")

    path = data.backup_dir.strip()
    if not path:
        raise HTTPException(status_code=400, detail="Backup directory path cannot be empty")

    try:
        os.makedirs(path, exist_ok=True)
        test_file = os.path.join(path, ".write_test")
        with open(test_file, "w") as f:
            f.write("ok")
        os.remove(test_file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot create or write to directory: {e}")

    row = db.query(SystemSettings).filter(SystemSettings.key == "backup_root_dir").first()
    if row:
        row.value = path
    else:
        row = SystemSettings(key="backup_root_dir", value=path)
        db.add(row)
    db.commit()

    settings.BACKUP_ROOT_DIR = path

    return {"backup_dir": path, "message": "Backup directory updated successfully"}
