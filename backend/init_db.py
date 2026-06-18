#!/usr/bin/env python3
"""Initialize the database and create default admin user."""

import sys
import os
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.version import __version__

from app.core.database import engine, Base, SessionLocal
from app.models.models import User, UserRole
from app.core.security import get_password_hash


def init_db():
    """Initialize database tables."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✓ Database tables created")


def create_admin_user():
    """Create default admin user if no users exist."""
    db = SessionLocal()
    try:
        # Check if any users exist
        user_count = db.query(User).count()
        
        if user_count == 0:
            print("Creating default admin user...")
            admin = User(
                username="admin",
                email="admin@pullbackup.local",
                hashed_password=get_password_hash("admin"),
                role=UserRole.ADMIN,
                is_active=True
            )
            db.add(admin)
            db.commit()
            print("✓ Default admin user created")
            print("  Username: admin")
            print("  Password: admin")
            print("  ⚠️  IMPORTANT: Change the password immediately!")
        else:
            print(f"✓ Database already has {user_count} user(s)")
    finally:
        db.close()


def create_directories():
    """Create necessary directories."""
    from app.core.config import settings
    
    dirs = [
        settings.BACKUP_ROOT_DIR,
        settings.SSH_KEYS_DIR,
        "data"
    ]
    
    for dir_path in dirs:
        Path(dir_path).mkdir(parents=True, exist_ok=True)
        print(f"✓ Created directory: {dir_path}")


if __name__ == "__main__":
    start = time.monotonic()
    started_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    print("=" * 50)
    print(f"PullBackup v{__version__} — Database Initialization")
    print(f"Started: {started_at}")
    print("=" * 50)

    create_directories()
    init_db()

    elapsed = time.monotonic() - start
    print("=" * 50)
    print(f"✓ Initialization complete! ({elapsed:.2f}s)")
    print("=" * 50)
