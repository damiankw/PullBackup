"""
Audit logging service for tracking user actions and system events.
"""

from sqlalchemy.orm import Session
from typing import Optional
from fastapi import Request

from app.models.models import AuditLog, AuditAction, User


class AuditService:
    """Service for logging audit events."""
    
    @staticmethod
    def log(
        db: Session,
        action: AuditAction,
        user: Optional[User] = None,
        username: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        resource_name: Optional[str] = None,
        description: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuditLog:
        """
        Create an audit log entry.
        
        Args:
            db: Database session
            action: Type of action performed
            user: User who performed the action (optional for failed logins)
            username: Username for failed login attempts
            resource_type: Type of resource (e.g., "server", "ssh_key")
            resource_id: ID of the affected resource
            resource_name: Name/identifier of the resource
            description: Additional details
            ip_address: IP address of the user
            user_agent: User agent string
        
        Returns:
            Created AuditLog entry
        """
        audit_log = AuditLog(
            user_id=user.id if user else None,
            username=username or (user.username if user else None),
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        
        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)
        
        return audit_log
    
    @staticmethod
    def log_from_request(
        db: Session,
        request: Request,
        action: AuditAction,
        user: Optional[User] = None,
        username: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[int] = None,
        resource_name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> AuditLog:
        """
        Create an audit log entry from a FastAPI request.
        
        Automatically extracts IP address and user agent from the request.
        """
        # Get IP address - check proxy/tunnel headers in priority order
        # 1. Cloudflare proxy header (most trusted when behind Cloudflare)
        ip_address = request.headers.get("CF-Connecting-IP")
        
        # 2. X-Real-IP (common reverse proxy header)
        if not ip_address:
            ip_address = request.headers.get("X-Real-IP")
        
        # 3. X-Forwarded-For (standard proxy header, take first/leftmost IP)
        if not ip_address:
            forwarded = request.headers.get("X-Forwarded-For")
            if forwarded:
                ip_address = forwarded.split(",")[0].strip()
        
        # 4. Fallback to direct connection
        if not ip_address:
            ip_address = request.client.host if request.client else None
        
        user_agent = request.headers.get("User-Agent")
        
        return AuditService.log(
            db=db,
            action=action,
            user=user,
            username=username,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            description=description,
            ip_address=ip_address,
            user_agent=user_agent,
        )


audit_service = AuditService()
