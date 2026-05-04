from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum
import uuid


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"


class BackupStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.USER, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    servers = relationship("Server", back_populates="owner", cascade="all, delete-orphan")
    backup_jobs = relationship("BackupJob", back_populates="owner", cascade="all, delete-orphan")


class Server(Base):
    __tablename__ = "servers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    hostname = Column(String(255), nullable=False)
    port = Column(Integer, default=22)
    username = Column(String(100), nullable=False)
    ssh_key_id = Column(Integer, ForeignKey("ssh_keys.id"), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    last_connection_test = Column(DateTime(timezone=True), nullable=True)
    connection_test_success = Column(Boolean, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    owner = relationship("User", back_populates="servers")
    ssh_key = relationship("SSHKey", back_populates="servers")
    backup_jobs = relationship("BackupJob", back_populates="server", cascade="all, delete-orphan")


class SSHKey(Base):
    __tablename__ = "ssh_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    fingerprint = Column(String(255), nullable=True)
    key_file_path = Column(String(500), nullable=False)
    is_public = Column(Boolean, default=False, nullable=False)  # Public keys visible to all users
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    owner = relationship("User")
    servers = relationship("Server", back_populates="ssh_key")


class BackupJob(Base):
    __tablename__ = "backup_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    backup_uuid = Column(String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=False)
    remote_path = Column(String(500), nullable=False)
    schedule = Column(String(100), nullable=True)  # Cron expression
    rsync_options = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)
    last_run = Column(DateTime(timezone=True), nullable=True)
    next_run = Column(DateTime(timezone=True), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    owner = relationship("User", back_populates="backup_jobs")
    server = relationship("Server", back_populates="backup_jobs")
    history = relationship("BackupHistory", back_populates="backup_job", cascade="all, delete-orphan")
    snapshots = relationship("Snapshot", back_populates="backup_job", cascade="all, delete-orphan")


class BackupHistory(Base):
    __tablename__ = "backup_history"
    
    id = Column(Integer, primary_key=True, index=True)
    backup_job_id = Column(Integer, ForeignKey("backup_jobs.id"), nullable=False)
    status = Column(Enum(BackupStatus), default=BackupStatus.PENDING, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    log_output = Column(Text, nullable=True)
    bytes_transferred = Column(Integer, default=0)
    files_transferred = Column(Integer, default=0)
    snapshot_size_bytes = Column(Integer, default=0)  # Actual disk usage (new data)
    snapshot_total_size_bytes = Column(Integer, default=0)  # Logical size (all files)
    space_saved_bytes = Column(Integer, default=0)  # Space saved by hardlinks
    triggered_by = Column(String(50), nullable=True)  # 'manual', 'schedule', 'api'
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    backup_job = relationship("BackupJob", back_populates="history")


class Snapshot(Base):
    __tablename__ = "snapshots"
    
    id = Column(Integer, primary_key=True, index=True)
    backup_job_id = Column(Integer, ForeignKey("backup_jobs.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)  # e.g., "2024-01-15_14-30-00"
    created_at = Column(DateTime(timezone=True), nullable=False)  # Parsed from snapshot name
    size_bytes = Column(Integer, default=0, nullable=False)  # Actual disk usage
    logical_size_bytes = Column(Integer, default=0, nullable=False)  # Logical size of all files
    file_count = Column(Integer, default=0)
    indexed_at = Column(DateTime(timezone=True), server_default=func.now())  # When we indexed this
    
    # Relationships
    backup_job = relationship("BackupJob")


class EmailSettings(Base):
    __tablename__ = "email_settings"
    
    id = Column(Integer, primary_key=True, index=True)
    smtp_host = Column(String(255), nullable=False)
    smtp_port = Column(Integer, default=587, nullable=False)
    smtp_username = Column(String(255), nullable=True)
    smtp_password = Column(String(255), nullable=True)
    smtp_use_tls = Column(Boolean, default=True, nullable=False)
    smtp_use_ssl = Column(Boolean, default=False, nullable=False)
    from_email = Column(String(255), nullable=False)
    from_name = Column(String(255), nullable=True)
    notify_on_success = Column(Boolean, default=False, nullable=False)
    notify_on_failure = Column(Boolean, default=True, nullable=False)
    notify_recipients = Column(Text, nullable=True)  # Comma-separated email addresses
    is_enabled = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
