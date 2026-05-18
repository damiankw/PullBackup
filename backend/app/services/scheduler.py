from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from datetime import datetime
from typing import Optional
import logging

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.models import BackupJob, BackupHistory, BackupStatus, Snapshot
from app.services.rsync_service import rsync_service

logger = logging.getLogger(__name__)


def execute_scheduled_backup(backup_job_id: int):
    """
    Execute a scheduled backup (standalone function for APScheduler).
    
    This must be a module-level function (not a class method) so APScheduler
    can serialize it for persistent job storage.
    """
    import os
    from pathlib import Path
    
    logger.info(f"Executing scheduled backup for job {backup_job_id}")
    
    db = SessionLocal()
    history = None
    backup_job = None
    
    try:
        # Get backup job first, before creating history
        backup_job = db.query(BackupJob).filter(BackupJob.id == backup_job_id).first()
        if not backup_job or not backup_job.is_active:
            logger.warning(f"Backup job {backup_job_id} not found or inactive")
            return
        
        # PRE-FLIGHT CHECK: Test storage availability before creating history
        backup_root = Path("/backups")
        storage_available = False
        storage_error = None
        
        try:
            # Quick check: does path exist and is writable?
            if not backup_root.exists():
                storage_error = "Backup path does not exist"
            else:
                # Try to write a test file with timeout (5 second max)
                # If NFS is hung, this will timeout instead of blocking forever
                import signal
                import threading
                
                test_result = {'success': False, 'error': None}
                
                def storage_check():
                    try:
                        test_file = backup_root / f".health_check_{backup_job_id}"
                        test_file.write_text("test")
                        test_file.unlink()
                        test_result['success'] = True
                    except Exception as e:
                        test_result['error'] = str(e)
                
                check_thread = threading.Thread(target=storage_check)
                check_thread.daemon = True
                check_thread.start()
                check_thread.join(timeout=5.0)  # 5 second timeout
                
                if check_thread.is_alive():
                    # Timeout - storage is hung
                    storage_error = "Storage check timed out (NFS/storage may be hung)"
                elif test_result['success']:
                    storage_available = True
                else:
                    storage_error = test_result['error'] or "Storage check failed"
        except Exception as check_error:
            storage_error = str(check_error)
            logger.error(f"Storage pre-check failed for job {backup_job_id}: {storage_error}")
        
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
        logger.info(f"Created backup history entry {history.id} for job {backup_job_id}")
        
        # If storage check failed, mark as failed immediately
        if not storage_available:
            history.status = BackupStatus.FAILED
            history.completed_at = datetime.now()
            history.error_message = f"Storage unavailable: {storage_error}"
            history.log_output = f"Pre-flight storage check failed.\n\nThe backup storage at /backups is not accessible. This usually indicates:\n- NAS is offline\n- Mount point is unavailable\n- Network storage disconnected\n\nError: {storage_error}"
            db.commit()
            logger.error(f"Backup job {backup_job_id} aborted - storage unavailable: {storage_error}")
            return
        
        # Get server info
        server = backup_job.server
        ssh_key_path = server.ssh_key.key_file_path if server.ssh_key else None
        
        # Execute backup
        success = False
        log_output = ""
        stats = {}
        
        try:
            success, log_output, stats = rsync_service.execute_backup(
                hostname=server.hostname,
                port=server.port,
                username=server.username,
                remote_path=backup_job.remote_path,
                ssh_key_path=ssh_key_path,
                rsync_options=backup_job.rsync_options,
                backup_uuid=backup_job.backup_uuid,
                job_name=backup_job.name,
                server_name=server.name,
                schedule=backup_job.schedule
            )
        except Exception as exec_error:
            success = False
            log_output = f"Backup execution error: {str(exec_error)}"
            stats = {'bytes_transferred': 0, 'files_transferred': 0, 'snapshot_size_bytes': 0, 'snapshot_total_size_bytes': 0, 'space_saved_bytes': 0}
            logger.error(f"Backup job {backup_job_id} execution error: {exec_error}")
        
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
        
        # Save snapshot metadata to database for fast listing (if successful)
        if success and stats.get('snapshot_path'):
            try:
                from pathlib import Path
                snapshot_path = Path(stats['snapshot_path'])
                snapshot_name = snapshot_path.name
                
                # Parse snapshot creation time from name (format: YYYY-MM-DD_HH-MM-SS)
                snapshot_created_at = datetime.strptime(snapshot_name[:19], '%Y-%m-%d_%H-%M-%S')
                
                # Check if snapshot already exists in database
                existing_snapshot = db.query(Snapshot).filter(
                    Snapshot.backup_job_id == backup_job.id,
                    Snapshot.name == snapshot_name
                ).first()
                
                if not existing_snapshot:
                    # Create new snapshot record
                    snapshot = Snapshot(
                        backup_job_id=backup_job.id,
                        name=snapshot_name,
                        created_at=snapshot_created_at,
                        size_bytes=stats.get('bytes_transferred', 0),  # Use rsync's actual transferred bytes
                        logical_size_bytes=stats.get('snapshot_total_size_bytes', 0),
                        file_count=stats.get('files_transferred', 0)
                    )
                    db.add(snapshot)
                else:
                    # Update existing snapshot
                    existing_snapshot.size_bytes = stats.get('bytes_transferred', 0)
                    existing_snapshot.logical_size_bytes = stats.get('snapshot_total_size_bytes', 0)
                    existing_snapshot.file_count = stats.get('files_transferred', 0)
                    existing_snapshot.indexed_at = datetime.now()
            except Exception as snapshot_error:
                logger.error(f"Failed to save snapshot metadata: {snapshot_error}")
        
        # Update backup job
        backup_job.last_run = datetime.now()
        # Note: next_run will be updated by APScheduler automatically
        
        db.commit()
        
        logger.info(f"Backup job {backup_job_id} completed with status: {history.status}")
        
        # Send email notification
        try:
            from app.services.email_service import EmailService
            email_service = EmailService(db)
            email_service.send_backup_notification(history)
        except Exception as email_error:
            logger.error(f"Failed to send email notification: {email_error}")
        
    except Exception as e:
        logger.error(f"Error executing scheduled backup {backup_job_id}: {str(e)}", exc_info=True)
        
        # Try to create/update failure record
        try:
            if history and history.id:
                # History exists in DB, update it
                history.status = BackupStatus.FAILED
                history.completed_at = datetime.now()
                history.error_message = f"Backup execution failed: {str(e)}"
                db.commit()
            else:
                # History doesn't exist or wasn't committed, create new one
                failure_history = BackupHistory(
                    backup_job_id=backup_job_id,
                    status=BackupStatus.FAILED,
                    started_at=datetime.now(),
                    completed_at=datetime.now(),
                    triggered_by='schedule',
                    error_message=f"Backup failed to start: {str(e)}",
                    log_output=f"Error: {str(e)}\n\nThis backup failed before execution could begin. This may indicate storage or database connectivity issues."
                )
                db.add(failure_history)
                db.commit()
                logger.info(f"Created failure history record for job {backup_job_id}")
        except Exception as db_error:
            # Even creating failure record failed - log to application logs
            logger.critical(
                f"CRITICAL: Backup job {backup_job_id} failed AND could not record failure in database! "
                f"Original error: {str(e)}, Database error: {str(db_error)}. "
                f"This indicates a serious storage or database connectivity issue.",
                exc_info=True
            )
    finally:
        try:
            db.close()
        except Exception:
            pass  # If even closing fails, we can't do much


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
            
            # Add new job using the module-level function (not a bound method)
            self.scheduler.add_job(
                func=execute_scheduled_backup,  # Module-level function, not self method
                trigger=trigger,
                args=[backup_job_id],
                id=job_id,
                name=f"Backup Job {backup_job_id}",
                replace_existing=True,
                misfire_grace_time=3600,  # Allow up to 1 hour late execution
                coalesce=True,  # If multiple runs were missed, only execute once
                max_instances=1  # Only one instance of this specific job at a time
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
    
    def reload_all_jobs(self):
        """Reload all active backup jobs from database."""
        logger.info("Reloading all scheduled backup jobs")
        
        db = SessionLocal()
        try:
            # Clean up stuck RUNNING jobs from previous crashes/hangs
            from datetime import timedelta
            stale_threshold = datetime.now() - timedelta(hours=6)  # Jobs running >6 hours are stuck
            
            stuck_jobs = db.query(BackupHistory).filter(
                BackupHistory.status == BackupStatus.RUNNING,
                BackupHistory.started_at < stale_threshold
            ).all()
            
            for stuck_job in stuck_jobs:
                logger.warning(f"Found stuck RUNNING job {stuck_job.id} from {stuck_job.started_at}, marking as FAILED")
                stuck_job.status = BackupStatus.FAILED
                stuck_job.completed_at = datetime.now()
                stuck_job.error_message = "Job was stuck in RUNNING state (likely hung on storage I/O). Marked as failed on scheduler restart."
                if not stuck_job.log_output:
                    stuck_job.log_output = "This backup was aborted because it was stuck in RUNNING state for more than 6 hours. This typically happens when storage becomes unavailable during execution."
            
            if stuck_jobs:
                db.commit()
                logger.info(f"Cleaned up {len(stuck_jobs)} stuck backup job(s)")
            
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
