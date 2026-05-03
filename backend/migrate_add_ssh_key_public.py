#!/usr/bin/env python3
"""
Migration: Add is_public column to ssh_keys table

This migration adds the is_public boolean column to allow SSH keys
to be shared across users. Public keys are visible to all users,
while private keys (is_public=False) are only visible to their owner.
"""

import sqlite3
import sys
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent / "data" / "pullbackup.db"

def migrate():
    """Add is_public column to ssh_keys table."""
    print("Starting migration: Add is_public to ssh_keys...")
    
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        print("Migration will be applied when database is created.")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(ssh_keys)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'is_public' in columns:
            print("✓ Column is_public already exists, skipping migration.")
            return
        
        print("Adding is_public column to ssh_keys table...")
        
        # Add the column with default value False
        cursor.execute("""
            ALTER TABLE ssh_keys 
            ADD COLUMN is_public BOOLEAN DEFAULT 0 NOT NULL
        """)
        
        conn.commit()
        print("✓ Successfully added is_public column")
        
        # Verify the change
        cursor.execute("PRAGMA table_info(ssh_keys)")
        columns = [col[1] for col in cursor.fetchall()]
        print(f"✓ Current columns: {', '.join(columns)}")
        
        # Show current key count
        cursor.execute("SELECT COUNT(*) FROM ssh_keys")
        count = cursor.fetchone()[0]
        print(f"✓ All {count} existing keys are private by default")
        
        print("\nMigration completed successfully!")
        
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
