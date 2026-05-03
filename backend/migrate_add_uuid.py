#!/usr/bin/env python3
"""
Migration script to add backup_uuid column to existing backup jobs
and migrate existing job-{id} folders to UUID-based folders.
"""
import sys
import uuid
import shutil
from pathlib import Path
from app.core.database import SessionLocal, engine
from app.models.models import BackupJob
from sqlalchemy import text

def main():
    print("Starting migration to add backup_uuid column...")
    
    db = SessionLocal()
    
    try:
        # Add the column if it doesn't exist
        print("Adding backup_uuid column...")
        try:
            db.execute(text("ALTER TABLE backup_jobs ADD COLUMN backup_uuid VARCHAR(36)"))
            db.commit()
            print("✓ Column added successfully")
        except Exception as e:
            if "duplicate column name" in str(e).lower():
                print("✓ Column already exists")
                db.rollback()
            else:
                raise
        
        # Generate UUIDs for existing jobs
        jobs = db.query(BackupJob).all()
        backup_root = Path("../backups").resolve()
        
        print(f"\nFound {len(jobs)} backup jobs")
        print(f"Backup root: {backup_root}")
        
        for job in jobs:
            if not job.backup_uuid:
                # Generate new UUID
                job_uuid = str(uuid.uuid4())
                job.backup_uuid = job_uuid
                
                print(f"\n  Job ID {job.id}: '{job.name}'")
                print(f"    UUID: {job_uuid}")
                
                # Check if old job-{id} folder exists and migrate it
                old_folder = backup_root / f"job-{job.id}"
                new_folder = backup_root / job_uuid
                
                if old_folder.exists():
                    print(f"    Migrating folder: job-{job.id} -> {job_uuid}")
                    old_folder.rename(new_folder)
                    print(f"    ✓ Folder migrated")
                else:
                    print(f"    No existing backup folder to migrate")
            else:
                print(f"\n  Job ID {job.id}: Already has UUID {job.backup_uuid}")
        
        db.commit()
        print("\n✓ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main()
