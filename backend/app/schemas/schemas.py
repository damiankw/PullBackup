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
    is_public: bool = False


class SSHKeyCreate(SSHKeyBase):
    private_key: str


class SSHKeyUpdate(BaseModel):
    is_public: bool


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
            # Basic cron validation supporting */N, comma-separated, and ranges
            parts = v.strip().split()
            if len(parts) != 5:
                raise ValueError('Invalid schedule format')
            
            def is_valid_cron_field(field, min_val, max_val):
                """Validate a single cron field."""
                if field == '*':
                    return True
                # Handle */N pattern (e.g., */4)
                if field.startswith('*/'):
                    try:
                        interval = int(field[2:])
                        return min_val <= interval <= max_val
                    except ValueError:
                        return False
                # Handle comma-separated values (e.g., 0,8,16)
                if ',' in field:
                    try:
                        values = [int(x) for x in field.split(',')]
                        return all(min_val <= val <= max_val for val in values)
                    except ValueError:
                        return False
                # Handle ranges (e.g., 1-5)
                if '-' in field:
                    try:
                        start, end = field.split('-')
                        start, end = int(start), int(end)
                        return min_val <= start <= end <= max_val
                    except ValueError:
                        return False
                # Handle single number
                try:
                    num = int(field)
                    return min_val <= num <= max_val
                except ValueError:
                    return False
            
            minute, hour, day, month, weekday = parts
            
            if not is_valid_cron_field(minute, 0, 59):
                raise ValueError('Invalid minute field')
            if not is_valid_cron_field(hour, 0, 23):
                raise ValueError('Invalid hour field')
            if not is_valid_cron_field(day, 1, 31):
                raise ValueError('Invalid day field')
            if not is_valid_cron_field(month, 1, 12):
                raise ValueError('Invalid month field')
            if not is_valid_cron_field(weekday, 0, 6):
                raise ValueError('Invalid weekday field')
        
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


# Email Settings Schemas
class EmailSettingsBase(BaseModel):
    smtp_host: str
    smtp_port: int = 587
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    from_email: str
    from_name: Optional[str] = None
    notify_on_success: bool = False
    notify_on_failure: bool = True
    notify_recipients: Optional[str] = None  # Comma-separated emails
    is_enabled: bool = False


class EmailSettingsCreate(EmailSettingsBase):
    pass


class EmailSettingsUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_use_tls: Optional[bool] = None
    smtp_use_ssl: Optional[bool] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    notify_on_success: Optional[bool] = None
    notify_on_failure: Optional[bool] = None
    notify_recipients: Optional[str] = None
    is_enabled: Optional[bool] = None


class EmailSettings(EmailSettingsBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class EmailTestRequest(BaseModel):
    recipient: str
