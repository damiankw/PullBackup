from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.database import engine, Base
from app.core.config import settings
from app.api import auth, servers, ssh_keys, backup_jobs, backup_history, dashboard, users, browse
from app.services.scheduler import backup_scheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting PullBackup application")
    
    # Create database tables
    Base.metadata.create_all(bind=engine)
    
    # Reload scheduled jobs
    backup_scheduler.reload_all_jobs()
    
    yield
    
    # Shutdown
    logger.info("Shutting down PullBackup application")
    backup_scheduler.shutdown()


# Create FastAPI app
app = FastAPI(
    title="PullBackup API",
    description="Enterprise backup system using rsync over SSH",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(servers.router, prefix="/api/servers", tags=["Servers"])
app.include_router(ssh_keys.router, prefix="/api/ssh-keys", tags=["SSH Keys"])
app.include_router(backup_jobs.router, prefix="/api/backup-jobs", tags=["Backup Jobs"])
app.include_router(backup_history.router, prefix="/api/backup-history", tags=["Backup History"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(browse.router, prefix="/api/browse", tags=["Browse Backups"])


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "name": "PullBackup API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
def health_check():
    """Health check endpoint for container orchestration."""
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
