#!/usr/bin/env python3
"""
Migration: Create email_settings table

This migration creates the email_settings table for storing SMTP configuration
and notification preferences.
"""

import sqlite3
import sys
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent / "data" / "pullbackup.db"

def migrate():
    """Create email_settings table."""
    print("Starting migration: Create email_settings table...")
    
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        print("Migration will be applied when database is created.")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if table already exists
        cursor.execute("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='email_settings'
        """)
        
        if cursor.fetchone():
            print("✓ Table email_settings already exists, skipping migration.")
            return
        
        print("Creating email_settings table...")
        
        # Create the table
        cursor.execute("""
            CREATE TABLE email_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                smtp_host VARCHAR(255) NOT NULL,
                smtp_port INTEGER NOT NULL DEFAULT 587,
                smtp_username VARCHAR(255),
                smtp_password VARCHAR(255),
                smtp_use_tls BOOLEAN NOT NULL DEFAULT 1,
                smtp_use_ssl BOOLEAN NOT NULL DEFAULT 0,
                from_email VARCHAR(255) NOT NULL,
                from_name VARCHAR(255),
                notify_on_success BOOLEAN NOT NULL DEFAULT 0,
                notify_on_failure BOOLEAN NOT NULL DEFAULT 1,
                notify_recipients TEXT,
                is_enabled BOOLEAN NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP
            )
        """)
        
        # Insert default settings (disabled by default)
        cursor.execute("""
            INSERT INTO email_settings (
                smtp_host, smtp_port, from_email, is_enabled, 
                notify_on_success, notify_on_failure
            ) VALUES (
                'smtp.gmail.com', 587, 'noreply@example.com', 0, 0, 1
            )
        """)
        
        conn.commit()
        print("✓ Successfully created email_settings table")
        print("✓ Inserted default configuration (disabled)")
        
        # Verify the change
        cursor.execute("SELECT COUNT(*) FROM email_settings")
        count = cursor.fetchone()[0]
        print(f"✓ Table has {count} row(s)")
        
        print("\nMigration completed successfully!")
        
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
