#!/usr/bin/env python3
"""Reset a user's password (creates admin if missing)."""
import sys
from pathlib import Path

# Add backend package path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import SessionLocal
from app.models.models import User, UserRole
from app.core.security import get_password_hash


def reset_password(username: str, password: str):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if user:
            user.hashed_password = get_password_hash(password)
            user.is_active = True
            db.add(user)
            db.commit()
            print(f"✓ Password for user '{username}' has been reset.")
        else:
            print(f"User '{username}' not found — creating new admin user.")
            admin = User(
                username=username,
                email=f"{username}@local",
                hashed_password=get_password_hash(password),
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(admin)
            db.commit()
            print(f"✓ Created user '{username}' with admin privileges.")
    finally:
        db.close()


if __name__ == '__main__':
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument('--username', '-u', default='admin')
    p.add_argument('--password', '-p', default='admin')
    args = p.parse_args()

    reset_password(args.username, args.password)
