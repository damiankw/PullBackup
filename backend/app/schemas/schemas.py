from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


# Enums
class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"


class BackupStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


# User Schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: UserRole = UserRole.USER


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str


# SSH Key Schemas
class SSHKeyBase(BaseModel):
    name: str


class SSHKeyCreate(SSHKeyBase):
    private_key: str


class SSHKey(SSHKeyBase):
    id: int
    fingerprint: Optional[str] = None
    created_at: datetime
    owner_id: int
    
    class Config:
        from_attributes = True


# Server Schemas
class ServerBase(BaseModel):
    name: str
    hostname: str
    port: int = 22
    username: str
    description: Optional[str] = None
    ssh_key_id: Optional[int] = None


class ServerCreate(ServerBase):
    pass


class ServerUpdate(BaseModel):
    name: Optional[str] = None
    hostname: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    description: Optional[str] = None
    ssh_key_id: Optional[int] = None
    is_active: Optional[bool] = None


class Server(ServerBase):
    id: int
    is_active: bool
    last_connection_test: Optional[datetime] = None
    connection_test_success: Optional[bool] = None
    owner_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# Backup Job Schemas
class BackupJobBase(BaseModel):
    name: str
    server_id: int
    remote_path: str
    schedule: Optional[str] = None
    rsync_options: Optional[str] = None
    
    @validator('schedule')
    def validate_schedule(cls, v):
        if v and v.strip():
            # Basic cron validation - you can make this more robust
            parts = v.strip().split()
            if len(parts) != 5:
                raise ValueError('Invalid schedule format')
            # Validate each part is either * or a number/range
            try:
                minute, hour, day, month, weekday = parts
                # Just basic validation that they're valid cron parts
                if minute != '*':
                    int(minute)
                if hour != '*':
                    int(hour)
                if day != '*':
                    int(day)
                if month != '*':
                    int(month)
                if weekday != '*':
                    int(weekday)
            except ValueError:
                raise ValueError('Invalid schedule format')
        return v


class BackupJobCreate(BackupJobBase):
    pass


class BackupJobUpdate(BaseModel):
    name: Optional[str] = None
    server_id: Optional[int] = None
    remote_path: Optional[str] = None
    schedule: Optional[str] = None
    rsync_options: Optional[str] = None
    is_active: Optional[bool] = None


class BackupJob(BackupJobBase):
    id: int
    is_active: bool
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    owner_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    server: Optional['Server'] = None
    
    class Config:
        from_attributes = True


# Backup History Schemas
class BackupHistoryBase(BaseModel):
    backup_job_id: int
    status: BackupStatus
    triggered_by: Optional[str] = None


class BackupHistoryCreate(BackupHistoryBase):
    pass


class BackupHistory(BackupHistoryBase):
    id: int
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    log_output: Optional[str] = None
    bytes_transferred: int = 0
    files_transferred: int = 0
    created_at: datetime
    backup_job: Optional['BackupJob'] = None
    
    class Config:
        from_attributes = True


# Response Schemas
class ServerWithJobs(Server):
    backup_jobs: List[BackupJob] = []


class BackupJobWithHistory(BackupJob):
    history: List[BackupHistory] = []
    server: Optional[Server] = None


class Stats(BaseModel):
    total_servers: int
    total_backup_jobs: int
    total_backups: int
    successful_backups: int
    failed_backups: int
    running_backups: int
