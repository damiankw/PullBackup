from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite:///./data/pullbackup.db"
    
    # Security
    SECRET_KEY: str = "your-super-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Backup Settings
    BACKUP_ROOT_DIR: str = "/backups"
    SSH_KEYS_DIR: str = "/app/ssh_keys"
    MAX_PARALLEL_BACKUPS: int = 3
    RSYNC_OPTIONS: str = "-avz --no-owner --no-group"
    
    # SMTP Settings
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: str = "noreply@pullbackup.com"
    
    # Application
    DEBUG: bool = False
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
