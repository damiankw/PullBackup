#!/usr/bin/env python3
"""
Migration: Add last_run and next_run columns to backup_jobs table

This migration adds scheduling tracking fields to the backup_jobs table
to support cron-based scheduled backups.
"""

import sqlite3
import sys
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent / "data" / "pullbackup.db"

def migrate():
    """Add last_run and next_run columns to backup_jobs table."""
    print("Starting migration: Add last_run and next_run to backup_jobs...")
    
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        print("Migration will be applied when database is created.")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(backup_jobs)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if "last_run" in columns and "next_run" in columns:
            print("Columns already exist. Skipping migration.")
            conn.close()
            return
        
        # Add last_run column if it doesn't exist
        if "last_run" not in columns:
            print("Adding last_run column...")
            cursor.execute("""
                ALTER TABLE backup_jobs
                ADD COLUMN last_run TIMESTAMP NULL
            """)
            print("✓ last_run column added")
        
        # Add next_run column if it doesn't exist
        if "next_run" not in columns:
            print("Adding next_run column...")
            cursor.execute("""
                ALTER TABLE backup_jobs
                ADD COLUMN next_run TIMESTAMP NULL
            """)
            print("✓ next_run column added")
        
        conn.commit()
        print("Migration completed successfully!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
