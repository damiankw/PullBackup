from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from datetime import datetime
from typing import Optional
import logging

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.models import BackupJob, BackupHistory, BackupStatus
from app.services.rsync_service import rsync_service

logger = logging.getLogger(__name__)


class BackupScheduler:
    """Scheduler for automated backups using APScheduler."""
    
    def __init__(self):
        jobstores = {
            'default': SQLAlchemyJobStore(url=settings.DATABASE_URL)
        }
        
        self.scheduler = BackgroundScheduler(
            jobstores=jobstores,
            job_defaults={
                'coalesce': False,
                'max_instances': settings.MAX_PARALLEL_BACKUPS
            }
        )
        self.scheduler.start()
        logger.info("Backup scheduler started")
    
    def add_job(self, backup_job_id: int, schedule: str) -> bool:
        """
        Add a scheduled backup job.
        
        Args:
            backup_job_id: ID of the backup job
            schedule: Cron expression
        
        Returns:
            True if job was added successfully
        """
        try:
            job_id = f"backup_job_{backup_job_id}"
            
            # Remove existing job if present
            self.remove_job(backup_job_id)
            
            # Parse cron expression (format: minute hour day month day_of_week)
            trigger = CronTrigger.from_crontab(schedule)
            
            # Add new job
            self.scheduler.add_job(
                func=self._execute_scheduled_backup,
                trigger=trigger,
                args=[backup_job_id],
                id=job_id,
                name=f"Backup Job {backup_job_id}",
                replace_existing=True
            )
            
            logger.info(f"Added scheduled job for backup {backup_job_id} with schedule: {schedule}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to add scheduled job for backup {backup_job_id}: {str(e)}")
            return False
    
    def remove_job(self, backup_job_id: int) -> bool:
        """Remove a scheduled job."""
        try:
            job_id = f"backup_job_{backup_job_id}"
            self.scheduler.remove_job(job_id)
            logger.info(f"Removed scheduled job for backup {backup_job_id}")
            return True
        except Exception as e:
            logger.debug(f"Job not found or error removing: {str(e)}")
            return False
    
    def get_next_run_time(self, backup_job_id: int) -> Optional[datetime]:
        """Get next scheduled run time for a backup job."""
        try:
            job_id = f"backup_job_{backup_job_id}"
            job = self.scheduler.get_job(job_id)
            if job:
                return job.next_run_time
            return None
        except Exception:
            return None
    
    def _execute_scheduled_backup(self, backup_job_id: int):
        """Execute a scheduled backup (called by APScheduler)."""
        logger.info(f"Executing scheduled backup for job {backup_job_id}")
        
        db = SessionLocal()
        try:
            # Get backup job
            backup_job = db.query(BackupJob).filter(BackupJob.id == backup_job_id).first()
            if not backup_job or not backup_job.is_active:
                logger.warning(f"Backup job {backup_job_id} not found or inactive")
                return
            
            # Create history entry
            history = BackupHistory(
                backup_job_id=backup_job_id,
                status=BackupStatus.RUNNING,
                started_at=datetime.now(),
                triggered_by='schedule'
            )
            db.add(history)
            db.commit()
            db.refresh(history)
            
            # Get server info
            server = backup_job.server
            ssh_key_path = server.ssh_key.key_file_path if server.ssh_key else None
            
            # Execute backup
            success, log_output, stats = rsync_service.execute_backup(
                hostname=server.hostname,
                port=server.port,
                username=server.username,
                remote_path=backup_job.remote_path,
                ssh_key_path=ssh_key_path,
                rsync_options=backup_job.rsync_options,
                backup_uuid=backup_job.backup_uuid,
                job_name=backup_job.name,
                server_name=server.name
            )
            
            # Update history
            history.status = BackupStatus.SUCCESS if success else BackupStatus.FAILED
            history.completed_at = datetime.now()
            history.log_output = log_output
            history.bytes_transferred = stats.get('bytes_transferred', 0)
            history.files_transferred = stats.get('files_transferred', 0)
            
            if not success:
                history.error_message = "Backup failed - check logs for details"
            
            # Update backup job
            backup_job.last_run = datetime.now()
            backup_job.next_run = self.get_next_run_time(backup_job_id)
            
            db.commit()
            
            logger.info(f"Backup job {backup_job_id} completed with status: {history.status}")
            
        except Exception as e:
            logger.error(f"Error executing scheduled backup {backup_job_id}: {str(e)}")
            
            # Update history with error
            try:
                history = db.query(BackupHistory).filter(
                    BackupHistory.backup_job_id == backup_job_id,
                    BackupHistory.status == BackupStatus.RUNNING
                ).order_by(BackupHistory.created_at.desc()).first()
                
                if history:
                    history.status = BackupStatus.FAILED
                    history.completed_at = datetime.now()
                    history.error_message = str(e)
                    db.commit()
            except Exception:
                pass
        finally:
            db.close()
    
    def reload_all_jobs(self):
        """Reload all active backup jobs from database."""
        logger.info("Reloading all scheduled backup jobs")
        
        db = SessionLocal()
        try:
            # Get all active backup jobs with schedules
            backup_jobs = db.query(BackupJob).filter(
                BackupJob.is_active == True,
                BackupJob.schedule.isnot(None),
                BackupJob.schedule != ''
            ).all()
            
            # Clear existing jobs
            self.scheduler.remove_all_jobs()
            
            # Add each job
            for job in backup_jobs:
                self.add_job(job.id, job.schedule)
                
            logger.info(f"Reloaded {len(backup_jobs)} scheduled backup jobs")
            
        except Exception as e:
            logger.error(f"Error reloading jobs: {str(e)}")
        finally:
            db.close()
    
    def shutdown(self):
        """Shutdown the scheduler."""
        self.scheduler.shutdown()
        logger.info("Backup scheduler stopped")


# Singleton instance
backup_scheduler = BackupScheduler()
