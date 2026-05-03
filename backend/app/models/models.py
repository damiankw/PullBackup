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
