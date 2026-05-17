from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.api.deps import get_current_active_user
from app.models.models import User, SSHKey, AuditAction
from app.schemas.schemas import SSHKeyCreate, SSHKeyUpdate, SSHKey as SSHKeySchema
from app.services.rsync_service import rsync_service
from app.services.audit_service import audit_service

router = APIRouter()


@router.get("/", response_model=List[SSHKeySchema])
def list_ssh_keys(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List SSH keys visible to current user (owned keys + public keys)."""
    from sqlalchemy import or_
    
    keys = db.query(SSHKey).filter(
        or_(
            SSHKey.owner_id == current_user.id,  # User's own keys
            SSHKey.is_public == True  # Public keys from any user
        )
    ).all()
    return keys


@router.post("/", response_model=SSHKeySchema, status_code=status.HTTP_201_CREATED)
def create_ssh_key(
    key_data: SSHKeyCreate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload and save SSH private key (and optionally public key)."""
    try:
        # Save key to disk and get/generate public key
        key_file_path, public_key_content = rsync_service.save_ssh_key(
            key_name=key_data.name,
            private_key_content=key_data.private_key,
            owner_id=current_user.id,
            public_key_content=key_data.public_key
        )
        
        # Get fingerprint
        fingerprint = rsync_service.get_ssh_key_fingerprint(key_file_path)
        
        # Create database record
        ssh_key = SSHKey(
            name=key_data.name,
            fingerprint=fingerprint,
            key_file_path=key_file_path,
            public_key_content=public_key_content,
            is_public=key_data.is_public,
            owner_id=current_user.id
        )
        
        db.add(ssh_key)
        db.commit()
        db.refresh(ssh_key)
        
        # Log audit event
        audit_service.log_from_request(
            db=db,
            request=request,
            action=AuditAction.CREATE,
            user=current_user,
            resource_type="ssh_key",
            resource_id=ssh_key.id,
            resource_name=ssh_key.name,
            description=f"Created SSH key '{ssh_key.name}' (fingerprint: {fingerprint})"
        )
        
        return ssh_key
        
    except ValueError as e:
        # Validation errors (e.g., invalid key format)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Other errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save SSH key: {str(e)}"
        )


@router.get("/{key_id}", response_model=SSHKeySchema)
def get_ssh_key(
    key_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get SSH key by ID (if owned by user or is public)."""
    from sqlalchemy import or_
    
    key = db.query(SSHKey).filter(
        SSHKey.id == key_id,
        or_(
            SSHKey.owner_id == current_user.id,
            SSHKey.is_public == True
        )
    ).first()
    
    if not key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SSH key not found"
        )
    
    return key


@router.patch("/{key_id}", response_model=SSHKeySchema)
def update_ssh_key(
    key_id: int,
    key_update: SSHKeyUpdate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update SSH key (visibility and/or public key)."""
    key = db.query(SSHKey).filter(
        SSHKey.id == key_id,
        SSHKey.owner_id == current_user.id
    ).first()
    
    if not key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SSH key not found or you don't have permission to modify it"
        )
    
    changes = []
    
    # Update public key if provided
    if key_update.public_key is not None:
        old_public_key_exists = key.public_key_content is not None
        key.public_key_content = key_update.public_key
        if old_public_key_exists:
            changes.append("updated public key")
        else:
            changes.append("added public key")
    
    # Update the is_public field if provided
    if key_update.is_public is not None:
        old_public = key.is_public
        key.is_public = key_update.is_public
        if old_public != key.is_public:
            changes.append(f"visibility: {'public' if old_public else 'private'} -> {'public' if key.is_public else 'private'}")
    
    db.commit()
    db.refresh(key)
    
    # Log audit event if changes were made
    if changes:
        audit_service.log_from_request(
            db=db,
            request=request,
            action=AuditAction.UPDATE,
            user=current_user,
            resource_type="ssh_key",
            resource_id=key.id,
            resource_name=key.name,
            description=f"Updated SSH key: {', '.join(changes)}"
        )
    
    return key


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ssh_key(
    key_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete SSH key."""
    key = db.query(SSHKey).filter(
        SSHKey.id == key_id,
        SSHKey.owner_id == current_user.id
    ).first()
    
    if not key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SSH key not found"
        )
    
    # Check if key is in use
    from app.models.models import Server
    servers_using_key = db.query(Server).filter(Server.ssh_key_id == key_id).count()
    
    if servers_using_key > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete key: {servers_using_key} server(s) are using it"
        )
    
    # Store key name before deletion
    key_name = key.name
    
    # Delete key file
    rsync_service.delete_ssh_key(key.key_file_path)
    
    # Delete database record
    db.delete(key)
    db.commit()
    
    # Log audit event
    audit_service.log_from_request(
        db=db,
        request=request,
        action=AuditAction.DELETE,
        user=current_user,
        resource_type="ssh_key",
        resource_id=key_id,
        resource_name=key_name,
        description=f"Deleted SSH key '{key_name}'"
    )
    
    return None


@router.post("/{key_id}/generate-public-key", response_model=SSHKeySchema)
def generate_public_key_for_key(
    key_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Generate public key from private key file."""
    key = db.query(SSHKey).filter(
        SSHKey.id == key_id,
        SSHKey.owner_id == current_user.id
    ).first()
    
    if not key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SSH key not found or you don't have permission to modify it"
        )
    
    # Generate public key from private key
    public_key = rsync_service.generate_public_key(key.key_file_path)
    
    if not public_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate public key from private key"
        )
    
    # Update the key with the generated public key
    key.public_key_content = public_key
    db.commit()
    db.refresh(key)
    
    # Log audit event
    audit_service.log_from_request(
        db=db,
        request=request,
        action=AuditAction.UPDATE,
        user=current_user,
        resource_type="ssh_key",
        resource_id=key.id,
        resource_name=key.name,
        description=f"Generated public key for SSH key '{key.name}'"
    )
    
    return key
