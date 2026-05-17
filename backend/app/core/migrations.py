"""
Database migrations that run automatically on application startup.
"""
import logging
from sqlalchemy import text, inspect
from app.core.database import engine

logger = logging.getLogger(__name__)


def run_migrations():
    """
    Run all pending database migrations.
    This executes automatically on application startup.
    """
    logger.info("Checking for pending database migrations...")
    
    with engine.connect() as conn:
        # Migration 1: Create audit_logs table if it doesn't exist
        _create_audit_logs_table(conn)
        
        # Migration 2: Add public_key_content column to ssh_keys
        _add_public_key_content_column(conn)
        
        conn.commit()
    
    logger.info("Database migrations completed")


def _create_audit_logs_table(conn):
    """Create audit_logs table if it doesn't exist."""
    inspector = inspect(engine)
    
    if 'audit_logs' in inspector.get_table_names():
        logger.info("✓ audit_logs table already exists")
        return
    
    logger.info("Creating audit_logs table...")
    
    conn.execute(text("""
        CREATE TABLE audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            username VARCHAR(50),
            action VARCHAR(20) NOT NULL,
            resource_type VARCHAR(50),
            resource_id INTEGER,
            resource_name VARCHAR(255),
            description TEXT,
            ip_address VARCHAR(45),
            user_agent TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """))
    
    # Create indexes for better query performance
    conn.execute(text("CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id)"))
    conn.execute(text("CREATE INDEX idx_audit_logs_action ON audit_logs(action)"))
    conn.execute(text("CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id)"))
    conn.execute(text("CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at)"))
    
    logger.info("✓ Created audit_logs table with indexes")


def _add_public_key_content_column(conn):
    """Add public_key_content column to ssh_keys table if it doesn't exist."""
    inspector = inspect(engine)
    
    if 'ssh_keys' not in inspector.get_table_names():
        logger.info("✓ ssh_keys table doesn't exist yet, will be created by Base.metadata.create_all()")
        return
    
    columns = [col['name'] for col in inspector.get_columns('ssh_keys')]
    
    if 'public_key_content' in columns:
        logger.info("✓ public_key_content column already exists in ssh_keys")
        return
    
    logger.info("Adding public_key_content column to ssh_keys table...")
    
    conn.execute(text("""
        ALTER TABLE ssh_keys 
        ADD COLUMN public_key_content TEXT
    """))
    
    logger.info("✓ Added public_key_content column to ssh_keys")
