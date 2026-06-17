"""
Logging configuration for PullBackup application.
Ensures all logs (application, uvicorn, and dependencies) have consistent timestamps.
"""

import logging
import sys

# Detailed log format with timestamp, logger name, level, and message
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

# Date format for timestamps (includes milliseconds for precision)
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def get_logging_config(debug: bool = False):
    """
    Get logging configuration dictionary for uvicorn.
    
    Args:
        debug: If True, set log level to DEBUG, otherwise INFO
    
    Returns:
        Dictionary configuration for Python logging
    """
    log_level = "DEBUG" if debug else "INFO"
    
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": LOG_FORMAT,
                "datefmt": DATE_FORMAT,
            },
            "access": {
                "format": LOG_FORMAT,
                "datefmt": DATE_FORMAT,
            },
        },
        "handlers": {
            "default": {
                "formatter": "default",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
            },
            "access": {
                "formatter": "access",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
            },
        },
        "loggers": {
            "uvicorn": {
                "handlers": ["default"],
                "level": log_level,
                "propagate": False,
            },
            "uvicorn.error": {
                "handlers": ["default"],
                "level": log_level,
                "propagate": False,
            },
            "uvicorn.access": {
                "handlers": ["access"],
                "level": log_level,
                "propagate": False,
            },
            "fastapi": {
                "handlers": ["default"],
                "level": log_level,
                "propagate": False,
            },
            "sqlalchemy": {
                "handlers": ["default"],
                "level": "WARNING",  # Reduce noise from SQLAlchemy
                "propagate": False,
            },
            "apscheduler": {
                "handlers": ["default"],
                "level": log_level,
                "propagate": False,
            },
        },
        "root": {
            "level": log_level,
            "handlers": ["default"],
        },
    }


def setup_logging(debug: bool = False):
    """
    Setup logging configuration for the application.
    This is called when the module is imported.
    
    Args:
        debug: If True, set log level to DEBUG, otherwise INFO
    """
    logging.config.dictConfig(get_logging_config(debug))


# Import logging.config for dictConfig
import logging.config
