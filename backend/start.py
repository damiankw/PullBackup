#!/usr/bin/env python3
"""
Startup script for PullBackup backend.
Configures logging and starts uvicorn with proper settings.
"""
import uvicorn
from app.core.config import settings
from app.core.logging_config import get_logging_config

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        log_config=get_logging_config(debug=settings.DEBUG),
        access_log=True,
    )
