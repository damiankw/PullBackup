from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.models import User, AuditLog, AuditAction, UserRole
from app.schemas.schemas import AuditLogResponse

router = APIRouter()


@router.get("/", response_model=List[AuditLogResponse])
def get_audit_logs(
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    username: Optional[str] = Query(None, description="Filter by username"),
    action: Optional[AuditAction] = Query(None, description="Filter by action type"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    resource_id: Optional[int] = Query(None, description="Filter by resource ID"),
    date_from: Optional[datetime] = Query(None, description="Filter by start date (ISO format)"),
    date_to: Optional[datetime] = Query(None, description="Filter by end date (ISO format)"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records to return"),
    offset: int = Query(0, ge=0, description="Number of records to skip"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get audit logs with optional filtering.
    Admin users can see all logs, regular users can only see their own.
    """
    # Build query
    query = db.query(AuditLog)
    
    # Non-admin users can only see their own audit logs
    if current_user.role != UserRole.ADMIN:
        query = query.filter(AuditLog.user_id == current_user.id)
    
    # Apply filters
    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)
    
    if username is not None:
        query = query.filter(AuditLog.username.ilike(f"%{username}%"))
    
    if action is not None:
        query = query.filter(AuditLog.action == action)
    
    if resource_type is not None:
        query = query.filter(AuditLog.resource_type == resource_type)
    
    if resource_id is not None:
        query = query.filter(AuditLog.resource_id == resource_id)
    
    if date_from is not None:
        query = query.filter(AuditLog.created_at >= date_from)
    
    if date_to is not None:
        query = query.filter(AuditLog.created_at <= date_to)
    
    # Order by most recent first
    query = query.order_by(AuditLog.created_at.desc())
    
    # Apply pagination
    total = query.count()
    logs = query.offset(offset).limit(limit).all()
    
    return logs


@router.get("/stats")
def get_audit_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get audit log statistics (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view audit statistics"
        )
    
    from sqlalchemy import func
    
    # Count by action type
    action_counts = db.query(
        AuditLog.action,
        func.count(AuditLog.id).label('count')
    ).group_by(AuditLog.action).all()
    
    # Count by resource type
    resource_counts = db.query(
        AuditLog.resource_type,
        func.count(AuditLog.id).label('count')
    ).group_by(AuditLog.resource_type).all()
    
    # Count by user (top 10)
    user_counts = db.query(
        AuditLog.username,
        func.count(AuditLog.id).label('count')
    ).filter(
        AuditLog.username.isnot(None)
    ).group_by(AuditLog.username).order_by(
        func.count(AuditLog.id).desc()
    ).limit(10).all()
    
    # Recent activity (last 24 hours)
    from datetime import timedelta
    yesterday = datetime.utcnow() - timedelta(days=1)
    recent_count = db.query(func.count(AuditLog.id)).filter(
        AuditLog.created_at >= yesterday
    ).scalar()
    
    return {
        "total_logs": db.query(func.count(AuditLog.id)).scalar(),
        "recent_activity_24h": recent_count,
        "by_action": {str(action): count for action, count in action_counts},
        "by_resource": {resource or "unknown": count for resource, count in resource_counts},
        "top_users": [{"username": username, "count": count} for username, count in user_counts]
    }
