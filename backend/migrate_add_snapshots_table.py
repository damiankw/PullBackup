#!/usr/bin/env python3
"""
Migration: Add snapshots table for caching snapshot metadata

This migration creates a new 'snapshots' table to store snapshot metadata
(size, date, etc.) so we don't have to scan the filesystem on every request.
"""

import sqlite3
import sys
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent / "data" / "pullbackup.db"

def main():
    print("=" * 50)
    print("Migration: Add snapshots table")
    print("=" * 50)
    
    if not DB_PATH.exists():
        print(f"❌ Database not found at {DB_PATH}")
        sys.exit(1)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if table already exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='snapshots'
        """)
        
        if cursor.fetchone():
            print("✓ snapshots table already exists. Skipping migration.")
            return
        
        print("Creating snapshots table...")
        
        # Create snapshots table
        cursor.execute("""
            CREATE TABLE snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                backup_job_id INTEGER NOT NULL,
                name VARCHAR(100) NOT NULL,
                created_at TIMESTAMP NOT NULL,
                size_bytes BIGINT NOT NULL DEFAULT 0,
                logical_size_bytes BIGINT NOT NULL DEFAULT 0,
                file_count INTEGER DEFAULT 0,
                indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (backup_job_id) REFERENCES backup_jobs (id) ON DELETE CASCADE,
                UNIQUE(backup_job_id, name)
            )
        """)
        
        # Create index for faster lookups
        cursor.execute("""
            CREATE INDEX idx_snapshots_backup_job_id 
            ON snapshots(backup_job_id)
        """)
        
        cursor.execute("""
            CREATE INDEX idx_snapshots_created_at 
            ON snapshots(created_at)
        """)
        
        conn.commit()
        print("✓ snapshots table created successfully")
        print("✓ Indexes created")
        
        print("=" * 50)
        print("✓ Migration completed successfully!")
        print("=" * 50)
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {e}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    main()
