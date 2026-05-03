# Migration: Remove local_path Field

## Overview
This migration removes the deprecated `local_path` field from the `backup_jobs` table. All backup jobs now use the `backup_uuid` field exclusively for storage organization.

## What Changed
- **Database**: Removed `local_path` column from `backup_jobs` table
- **Backend Model**: Removed `local_path` from BackupJob model
- **Backend Schemas**: Removed `local_path` from BackupJobBase and BackupJobUpdate
- **Backend Services**: Removed `local_path`, `job_id` parameters from rsync_service methods
- **Frontend**: Removed "Local Path" field from Backup Job creation/edit form

## Running the Migration

### For Development (Local)
```bash
cd backend
python3 migrate_remove_local_path.py
```

### For Docker/Kubernetes Deployments
The migration will run automatically when the container starts if you add it to your startup script.

**Option 1 - Manual Run (Docker)**
```bash
# Exec into running container
docker exec -it <container-name> bash
cd /app
python3 migrate_remove_local_path.py
```

**Option 2 - Automatic Run (Add to Dockerfile CMD)**
Update your Dockerfile.backend CMD to:
```dockerfile
CMD ["sh", "-c", "python migrate_remove_local_path.py && python init_db.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

**Option 3 - Kubernetes Init Container**
Add an init container to run migrations before the main container starts.

## Verification
After migration, verify:
```bash
# Check database schema
sqlite3 data/pullbackup.db ".schema backup_jobs"

# Should NOT see local_path column
# Should see: id, backup_uuid, name, server_id, remote_path, schedule, rsync_options, is_active, created_at, updated_at, owner_id
```

## Rollback
⚠️ **Warning**: This migration is destructive. The `local_path` column is permanently removed.

If you need to rollback:
1. Restore database from backup
2. Revert code changes to previous version

## Notes
- Existing backup folders on disk are not affected
- All backups remain accessible via their `backup_uuid` paths
- No data loss - only the unused `local_path` field is removed
