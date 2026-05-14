"""
Email settings and notification management endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.models import User, EmailSettings, UserRole
from app.schemas.schemas import (
    EmailSettings as EmailSettingsSchema,
    EmailSettingsCreate,
    EmailSettingsUpdate,
    EmailTestRequest
)
from app.api.deps import get_current_active_user
from app.services.email_service import EmailService


router = APIRouter()


@router.get("/", response_model=EmailSettingsSchema)
def get_email_settings(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get email configuration settings (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = db.query(EmailSettings).first()
    
    if not settings:
        # Create default settings if none exist
        settings = EmailSettings(
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            from_email="noreply@example.com",
            is_enabled=False,
            notify_on_success=False,
            notify_on_failure=True
        )
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    # Return settings without password for security
    settings_dict = {
        'id': settings.id,
        'smtp_host': settings.smtp_host,
        'smtp_port': settings.smtp_port,
        'smtp_username': settings.smtp_username,
        'smtp_password': None,  # Never send password back
        'smtp_use_tls': settings.smtp_use_tls,
        'smtp_use_ssl': settings.smtp_use_ssl,
        'from_email': settings.from_email,
        'from_name': settings.from_name,
        'notify_on_success': settings.notify_on_success,
        'notify_on_failure': settings.notify_on_failure,
        'notify_recipients': settings.notify_recipients,
        'is_enabled': settings.is_enabled,
        'created_at': settings.created_at,
        'updated_at': settings.updated_at,
    }
    
    return settings_dict


@router.put("/", response_model=EmailSettingsSchema)
def update_email_settings(
    settings_update: EmailSettingsUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update email configuration settings (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    settings = db.query(EmailSettings).first()
    
    if not settings:
        # Create if doesn't exist
        settings = EmailSettings(
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            from_email="noreply@example.com",
            is_enabled=False
        )
        db.add(settings)
    
    # Update only provided fields
    update_data = settings_update.dict(exclude_unset=True)
    
    # Don't update password if it's None or empty (means user didn't change it)
    if 'smtp_password' in update_data and not update_data['smtp_password']:
        del update_data['smtp_password']
    
    for field, value in update_data.items():
        setattr(settings, field, value)
    
    db.commit()
    db.refresh(settings)
    
    # Return settings without password for security
    settings_dict = {
        'id': settings.id,
        'smtp_host': settings.smtp_host,
        'smtp_port': settings.smtp_port,
        'smtp_username': settings.smtp_username,
        'smtp_password': None,  # Never send password back
        'smtp_use_tls': settings.smtp_use_tls,
        'smtp_use_ssl': settings.smtp_use_ssl,
        'from_email': settings.from_email,
        'from_name': settings.from_name,
        'notify_on_success': settings.notify_on_success,
        'notify_on_failure': settings.notify_on_failure,
        'notify_recipients': settings.notify_recipients,
        'is_enabled': settings.is_enabled,
        'created_at': settings.created_at,
        'updated_at': settings.updated_at,
    }
    
    return settings_dict


@router.post("/test")
def send_test_email(
    test_request: EmailTestRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Send a test email to verify configuration (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    email_service = EmailService(db)
    
    success, error_msg = email_service.send_test_email(test_request.recipient)
    
    if success:
        return {"message": f"Test email sent successfully to {test_request.recipient}"}
    else:
        raise HTTPException(
            status_code=500,
            detail=error_msg or "Failed to send test email. Please check your email configuration."
        )
