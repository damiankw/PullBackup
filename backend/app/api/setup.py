from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
import os
import secrets

from app.core.database import get_db
from app.models.models import User, UserRole, SystemSettings, EmailSettings
from app.core.security import get_password_hash
from app.core.config import settings

router = APIRouter()


def _is_setup_complete(db: Session) -> bool:
    return db.query(User).count() > 0


@router.get("/status")
def get_setup_status(db: Session = Depends(get_db)):
    return {"completed": _is_setup_complete(db)}


class EmailSetupConfig(BaseModel):
    smtp_host: str
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: str
    use_tls: bool = True
    notify_recipients: Optional[str] = None


class SetupRequest(BaseModel):
    username: str
    email: str
    password: str
    backup_dir: str
    email_config: Optional[EmailSetupConfig] = None


@router.post("/complete")
def complete_setup(data: SetupRequest, db: Session = Depends(get_db)):
    if _is_setup_complete(db):
        raise HTTPException(status_code=400, detail="Setup has already been completed")

    # Validate / create backup directory
    try:
        Path(data.backup_dir).mkdir(parents=True, exist_ok=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot create backup directory: {e}")

    # Create admin user
    admin = User(
        username=data.username,
        email=data.email,
        hashed_password=get_password_hash(data.password),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db.add(admin)

    # Persist backup dir
    db.merge(SystemSettings(key="backup_root_dir", value=data.backup_dir))

    # Generate and persist a unique secret key
    secret_key = secrets.token_hex(32)
    db.merge(SystemSettings(key="secret_key", value=secret_key))

    # Apply to runtime settings immediately so current process uses both
    settings.BACKUP_ROOT_DIR = data.backup_dir
    settings.SECRET_KEY = secret_key

    # Optional email config
    if data.email_config and data.email_config.smtp_host:
        email_setting = EmailSettings(
            smtp_host=data.email_config.smtp_host,
            smtp_port=data.email_config.smtp_port,
            smtp_username=data.email_config.smtp_user,
            smtp_password=data.email_config.smtp_password,
            smtp_use_tls=data.email_config.use_tls,
            from_email=data.email_config.smtp_from,
            notify_on_failure=True,
            notify_recipients=data.email_config.notify_recipients,
            is_enabled=True,
        )
        db.add(email_setting)

    db.commit()
    return {"message": "Setup completed successfully"}


@router.get("/browse-dirs")
def browse_dirs(path: str = "/"):
    """Browse server-side directories for the backup location picker."""
    path = os.path.normpath(path)

    if not os.path.isdir(path):
        raise HTTPException(status_code=404, detail="Path not found")

    dirs = []
    try:
        with os.scandir(path) as it:
            for entry in it:
                try:
                    if entry.is_dir(follow_symlinks=False):
                        dirs.append({"name": entry.name, "path": entry.path})
                except PermissionError:
                    pass
        dirs.sort(key=lambda x: x["name"].lower())
    except PermissionError:
        pass

    parent = str(Path(path).parent)
    if parent == path:
        parent = None

    return {"path": path, "parent": parent, "dirs": dirs}
