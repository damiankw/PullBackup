#!/usr/bin/env python3
"""
Migration script to add snapshot size tracking fields to backup_history table.
"""
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import create_engine, text
from app.core.config import settings

def migrate():
    """Add snapshot size fields to backup_history table."""
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        print("Adding snapshot size tracking fields to backup_history table...")
        
        # Add new columns
        try:
            conn.execute(text(
                "ALTER TABLE backup_history ADD COLUMN snapshot_size_bytes INTEGER DEFAULT 0"
            ))
            print("✓ Added snapshot_size_bytes column")
        except Exception as e:
            print(f"  snapshot_size_bytes column may already exist: {e}")
        
        try:
            conn.execute(text(
                "ALTER TABLE backup_history ADD COLUMN snapshot_total_size_bytes INTEGER DEFAULT 0"
            ))
            print("✓ Added snapshot_total_size_bytes column")
        except Exception as e:
            print(f"  snapshot_total_size_bytes column may already exist: {e}")
        
        try:
            conn.execute(text(
                "ALTER TABLE backup_history ADD COLUMN space_saved_bytes INTEGER DEFAULT 0"
            ))
            print("✓ Added space_saved_bytes column")
        except Exception as e:
            print(f"  space_saved_bytes column may already exist: {e}")
        
        conn.commit()
        
        print("\n✓ Migration completed successfully!")

if __name__ == "__main__":
    migrate()
