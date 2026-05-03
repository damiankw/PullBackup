from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
import os
import shutil
import psutil
from datetime import datetime, timedelta

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.models import User, UserRole, BackupJob, BackupHistory, Server, SSHKey

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
    backup_path = "/backups"
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
    
    backup_path = "/backups"
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
