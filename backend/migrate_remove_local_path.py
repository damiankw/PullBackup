#!/usr/bin/env python3
"""
Migration: Remove local_path column from backup_jobs table
This field is deprecated and has been replaced by backup_uuid.
"""

import sqlite3
import sys
from pathlib import Path

def migrate():
    db_path = Path(__file__).parent / "data" / "pullbackup.db"
    
    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        sys.exit(1)
    
    print("=" * 50)
    print("Migration: Remove local_path from backup_jobs")
    print("=" * 50)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if local_path column exists
        cursor.execute("PRAGMA table_info(backup_jobs)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'local_path' not in columns:
            print("✓ Column 'local_path' already removed, nothing to do")
            conn.close()
            return
        
        print(f"Found {len(columns)} columns in backup_jobs table")
        print(f"Current columns: {', '.join(columns)}")
        
        # SQLite doesn't support DROP COLUMN directly, need to recreate table
        print("\nStep 1: Creating new table without local_path...")
        
        # Get current table schema
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='backup_jobs'")
        original_schema = cursor.fetchone()[0]
        
        # Create new table without local_path
        cursor.execute("""
            CREATE TABLE backup_jobs_new (
                id INTEGER PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                server_id INTEGER NOT NULL,
                remote_path VARCHAR(500) NOT NULL,
                schedule VARCHAR(100),
                rsync_options VARCHAR(500),
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME,
                owner_id INTEGER NOT NULL,
                backup_uuid VARCHAR(36) NOT NULL UNIQUE,
                FOREIGN KEY(server_id) REFERENCES servers (id),
                FOREIGN KEY(owner_id) REFERENCES users (id)
            )
        """)
        
        # Copy data (excluding local_path)
        print("Step 2: Copying data to new table...")
        cursor.execute("""
            INSERT INTO backup_jobs_new 
            (id, name, server_id, remote_path, schedule, rsync_options, is_active, 
             created_at, updated_at, owner_id, backup_uuid)
            SELECT id, name, server_id, remote_path, schedule, rsync_options, is_active,
                   created_at, updated_at, owner_id, backup_uuid
            FROM backup_jobs
        """)
        
        rows_copied = cursor.rowcount
        print(f"✓ Copied {rows_copied} backup jobs")
        
        # Drop old table
        print("Step 3: Dropping old table...")
        cursor.execute("DROP TABLE backup_jobs")
        
        # Rename new table
        print("Step 4: Renaming new table...")
        cursor.execute("ALTER TABLE backup_jobs_new RENAME TO backup_jobs")
        
        # Recreate indices
        print("Step 5: Recreating indices...")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_backup_jobs_name ON backup_jobs (name)")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_backup_jobs_backup_uuid ON backup_jobs (backup_uuid)")
        
        # Commit changes
        conn.commit()
        
        # Verify
        cursor.execute("PRAGMA table_info(backup_jobs)")
        new_columns = [col[1] for col in cursor.fetchall()]
        
        print("\n" + "=" * 50)
        print("✓ Migration completed successfully!")
        print("=" * 50)
        print(f"Removed column: local_path")
        print(f"Remaining columns: {', '.join(new_columns)}")
        print(f"Backup jobs migrated: {rows_copied}")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
