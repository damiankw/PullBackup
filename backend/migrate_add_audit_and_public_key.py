#!/usr/bin/env python3
"""
Migration: Add audit_logs table and public_key_content column

This migration:
1. Creates the audit_logs table for tracking user actions
2. Adds public_key_content column to ssh_keys table for storing public keys
"""

import sqlite3
import sys
from pathlib import Path

# Database path - update this for your production environment
DB_PATH = Path(__file__).parent / "data" / "pullbackup.db"

def migrate():
    """Apply migrations for audit logs and public key content."""
    print("Starting migration: Add audit_logs table and public_key_content column...")
    
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        print("Migration will be applied when database is created.")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Migration 1: Create audit_logs table
        print("\n1. Checking audit_logs table...")
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs'")
        if cursor.fetchone():
            print("✓ audit_logs table already exists, skipping creation.")
        else:
            print("Creating audit_logs table...")
            cursor.execute("""
                CREATE TABLE audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    username VARCHAR(50),
                    action VARCHAR(20) NOT NULL,
                    resource_type VARCHAR(50),
                    resource_id INTEGER,
                    resource_name VARCHAR(255),
                    description TEXT,
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            """)
            
            # Create indexes for better query performance
            cursor.execute("CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id)")
            cursor.execute("CREATE INDEX idx_audit_logs_action ON audit_logs(action)")
            cursor.execute("CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id)")
            cursor.execute("CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at)")
            
            conn.commit()
            print("✓ Successfully created audit_logs table with indexes")
        
        # Migration 2: Add public_key_content column to ssh_keys
        print("\n2. Checking public_key_content column in ssh_keys...")
        cursor.execute("PRAGMA table_info(ssh_keys)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'public_key_content' in columns:
            print("✓ Column public_key_content already exists, skipping.")
        else:
            print("Adding public_key_content column to ssh_keys table...")
            cursor.execute("""
                ALTER TABLE ssh_keys 
                ADD COLUMN public_key_content TEXT
            """)
            conn.commit()
            print("✓ Successfully added public_key_content column")
        
        # Verify migrations
        print("\n3. Verifying migrations...")
        cursor.execute("PRAGMA table_info(ssh_keys)")
        ssh_columns = [col[1] for col in cursor.fetchall()]
        print(f"✓ ssh_keys columns: {', '.join(ssh_columns)}")
        
        cursor.execute("SELECT COUNT(*) FROM ssh_keys")
        key_count = cursor.fetchone()[0]
        print(f"✓ Found {key_count} SSH keys in database")
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_logs'")
        if cursor.fetchone():
            print("✓ audit_logs table verified")
        
        print("\n✅ Migration completed successfully!")
        print("\nNote: Existing SSH keys will have NULL public_key_content.")
        print("You can generate public keys using the 'Generate Public Key' button in the UI.")
        
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    # Allow custom database path via command line
    if len(sys.argv) > 1:
        DB_PATH = Path(sys.argv[1])
        print(f"Using custom database path: {DB_PATH}")
    
    migrate()
