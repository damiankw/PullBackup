#!/usr/bin/env python3
"""
Generate README.md files for all existing backup jobs.
"""
from app.core.database import SessionLocal
from app.models.models import BackupJob
from app.services.rsync_service import rsync_service

def main():
    print("Generating README.md files for all backup jobs...")
    
    db = SessionLocal()
    
    try:
        jobs = db.query(BackupJob).all()
        
        print(f"Found {len(jobs)} backup jobs\n")
        
        for job in jobs:
            server = job.server
            
            print(f"Generating README for job: {job.name}")
            print(f"  UUID: {job.backup_uuid}")
            print(f"  Server: {server.name}")
            
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
            print(f"  ✓ README generated\n")
        
        print("✓ All README files generated successfully!")
        
    except Exception as e:
        print(f"✗ Failed to generate READMEs: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
