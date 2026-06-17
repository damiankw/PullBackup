from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging

from app.core.database import engine, Base
from app.core.config import settings
from app.core.migrations import run_migrations
from app.core.logging_config import setup_logging
from app.api import auth, servers, ssh_keys, backup_jobs, backup_history, dashboard, users, browse, system, email, audit, terminal
from app.services.scheduler import backup_scheduler

FRONTEND_DIR = Path(__file__).parent.parent / 'frontend_build'

# Configure logging with timestamps
setup_logging(debug=settings.DEBUG)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    # Startup
    logger.info("Starting PullBackup application")
    
    # Run database migrations first
    run_migrations()
    
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
app.include_router(system.router, prefix="/api/system", tags=["System"])
app.include_router(email.router, prefix="/api/email", tags=["Email"])
app.include_router(audit.router, prefix="/api/audit-logs", tags=["Audit Logs"])
app.include_router(terminal.router, prefix="/api/terminal", tags=["Terminal"])


@app.get("/health")
def health_check():
    """Health check endpoint for container orchestration."""
    return {"status": "healthy"}


# Serve the compiled React app.
# This must come after all API routes so /api/* is never intercepted.
if (FRONTEND_DIR / 'static').exists():
    app.mount('/static', StaticFiles(directory=FRONTEND_DIR / 'static'), name='react-static')


@app.get('/{full_path:path}', include_in_schema=False)
async def serve_spa(full_path: str):
    # Serve real files that exist in the build dir (favicon.ico, manifest.json, …)
    candidate = FRONTEND_DIR / full_path
    if candidate.exists() and candidate.is_file():
        return FileResponse(candidate)
    # Fall back to index.html so React Router handles the path client-side
    index = FRONTEND_DIR / 'index.html'
    if index.exists():
        return FileResponse(index)
    return {"name": "PullBackup API", "version": "1.0.0", "status": "running"}


if __name__ == "__main__":
    import uvicorn
    from app.core.logging_config import get_logging_config
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_config=get_logging_config(debug=settings.DEBUG)
    )
